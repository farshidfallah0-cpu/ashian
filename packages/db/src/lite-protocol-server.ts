import net from 'node:net';
import type { PGlite } from '@electric-sql/pglite';

/**
 * سرور پروتکل PostgreSQL روی PGlite، مخصوص حالت توسعه (lite).
 *
 * چرا خودمان نوشتیم؟ PGlite تنها یک session دارد و اتصال‌ها آن را به اشتراک می‌گذارند.
 * کتابخانه‌ی pglite-socket پیام‌های یک کوئری را جدا جدا صف می‌کند (Parse، Bind، Execute…)
 * و بعد از یک خطای عادی (مثلاً قطع ناگهانی کلاینت با Ctrl+C) برای همیشه قفل می‌شود.
 * این سرور:
 *   - همه‌ی پیام‌های کامل یک بسته‌ی شبکه را اتمیک اجرا می‌کند (یک کوئری = یک واحد)؛
 *   - مالکیت تراکنش را نگه می‌دارد تا کوئری کلاینت دیگر وارد تراکنش باز نشود؛
 *   - قطع اتصال را تحمل می‌کند (rollback خودکار) و هرگز صف را گیر نمی‌اندازد.
 */

const SSL_REQUEST = 80877103;
const CANCEL_REQUEST = 80877102;
const PROTOCOL_V3 = 196608;
/** تراکنشی که این‌قدر بی‌حرکت بماند rollback می‌شود تا دیگران منتظر نمانند */
const TX_IDLE_LIMIT_MS = 30_000;

interface Task {
  conn: Conn;
  bytes: Buffer;
}

interface Conn {
  id: number;
  socket: net.Socket;
  buffer: Buffer;
  closed: boolean;
}

export interface LiteServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  stats(): { connections: number; queued: number };
}

export function createLiteServer(db: PGlite, options: { host: string; port: number }): LiteServer {
  let nextId = 1;
  const conns = new Set<Conn>();
  const queue: Task[] = [];
  let running = false;
  /** اتصالی که الان تراکنش باز دارد */
  let txOwner: Conn | null = null;
  let txTimer: NodeJS.Timeout | undefined;

  const releaseTx = async () => {
    clearTimeout(txTimer);
    txOwner = null;
    if (db.isInTransaction()) {
      try {
        await db.exec('ROLLBACK');
      } catch {
        /* نشست خودش پاک می‌شود */
      }
    }
  };

  /** تاسک بعدی: اگر تراکنش باز است فقط از صاحبش، وگرنه اولین تاسک صف */
  const pickTask = (): Task | undefined => {
    if (!txOwner) return queue.shift();
    const index = queue.findIndex((t) => t.conn === txOwner);
    return index === -1 ? undefined : queue.splice(index, 1)[0];
  };

  const drain = async () => {
    if (running) return;
    running = true;
    try {
      for (;;) {
        const task = pickTask();
        if (!task) break;
        if (task.conn.closed) continue;
        try {
          const out = await db.execProtocolRaw(task.bytes);
          if (!task.conn.closed && task.conn.socket.writable) task.conn.socket.write(out);
        } catch (error) {
          // خطای داخلی PGlite: همین اتصال بسته می‌شود، بقیه ادامه می‌دهند
          console.error('[lite-db] خطای اجرای پیام:', (error as Error).message);
          task.conn.socket.destroy();
          if (txOwner === task.conn) await releaseTx();
          continue;
        }
        if (db.isInTransaction()) {
          txOwner = task.conn;
          clearTimeout(txTimer);
          txTimer = setTimeout(() => {
            console.error('[lite-db] تراکنش بی‌حرکت rollback شد');
            void releaseTx().then(drain);
          }, TX_IDLE_LIMIT_MS);
        } else if (txOwner) {
          txOwner = null;
          clearTimeout(txTimer);
        }
      }
    } finally {
      running = false;
    }
  };

  /** پیام‌های کامل بافر را جدا می‌کند و برمی‌گرداند (بقیه در بافر می‌ماند) */
  const extract = (conn: Conn): Buffer | null => {
    let end = 0;
    const buf = conn.buffer;
    while (buf.length - end >= 4) {
      const remaining = buf.length - end;
      if (remaining >= 8) {
        const first = buf.readInt32BE(end);
        const second = buf.readInt32BE(end + 4);
        if (first === 8 && second === SSL_REQUEST) {
          conn.socket.write('N'); // TLS پشتیبانی نمی‌شود؛ کلاینت بدون TLS ادامه می‌دهد
          end += 8;
          continue;
        }
        if (first === 16 && second === CANCEL_REQUEST) {
          end += 16; // PGlite پروسه‌ی جدا ندارد؛ لغو بی‌پاسخ نادیده گرفته می‌شود
          continue;
        }
        if (second === PROTOCOL_V3) {
          if (remaining < first) break;
          end += first;
          continue;
        }
      }
      if (remaining < 5) break;
      const length = 1 + buf.readInt32BE(end + 1);
      if (remaining < length) break;
      end += length;
    }
    return end > 0 ? buf.subarray(0, end) : null;
  };

  const server = net.createServer((socket) => {
    const conn: Conn = { id: nextId++, socket, buffer: Buffer.alloc(0), closed: false };
    conns.add(conn);
    socket.setNoDelay(true);

    socket.on('data', (data) => {
      conn.buffer = Buffer.concat([conn.buffer, data]);
      const complete = extract(conn);
      if (!complete) return;
      // SSLRequest/Cancel بدون پاسخ از بافر حذف شده‌اند؛ فقط پیام‌های واقعی به PGlite می‌روند
      const consumed = complete.length;
      const payload = stripHandshake(complete);
      conn.buffer = conn.buffer.subarray(consumed);
      if (payload.length > 0) {
        queue.push({ conn, bytes: payload });
        void drain();
      }
    });

    const cleanup = () => {
      if (conn.closed) return;
      conn.closed = true;
      conns.delete(conn);
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i]!.conn === conn) queue.splice(i, 1);
      if (txOwner === conn) void releaseTx().then(drain);
    };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });

  return {
    start: () =>
      new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port, options.host, () => resolve());
      }),
    stop: async () => {
      for (const conn of conns) conn.socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
    stats: () => ({ connections: conns.size, queued: queue.length }),
  };
}

/** SSLRequest و CancelRequest را از بایت‌های ارسالی به PGlite حذف می‌کند */
function stripHandshake(bytes: Buffer): Buffer {
  const parts: Buffer[] = [];
  let i = 0;
  while (i < bytes.length) {
    if (bytes.length - i >= 8) {
      const first = bytes.readInt32BE(i);
      const second = bytes.readInt32BE(i + 4);
      if (first === 8 && second === SSL_REQUEST) {
        i += 8;
        continue;
      }
      if (first === 16 && second === CANCEL_REQUEST) {
        i += 16;
        continue;
      }
      if (second === PROTOCOL_V3) {
        parts.push(bytes.subarray(i, i + first));
        i += first;
        continue;
      }
    }
    const length = 1 + bytes.readInt32BE(i + 1);
    parts.push(bytes.subarray(i, i + length));
    i += length;
  }
  return Buffer.concat(parts);
}
