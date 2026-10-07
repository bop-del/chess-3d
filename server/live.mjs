// The live stream of online play (CHE-271): Server-Sent Events over a plain HTTP response. A player is present while at least one
// stream of theirs is open. Every event is `state` with the same shape as GET /state; a comment line every 20 s keeps proxies
// (kamal-proxy, nginx) from closing an idle stream. The transport lives here and in src/online/api.js only, so a later switch to
// WebSocket touches these two files.
export function createLive({ heartbeatMs = 20000, onPresence = () => {}, onBeat = () => {}, onStream = () => {} } = {}) {
  const streams = new Map();   // player id -> Set of responses
  const timer = setInterval(() => {
    for (const set of streams.values()) for (const res of set) { try { res.write(': hb\n\n'); } catch (e) { /* closed */ } }
    onBeat();
  }, heartbeatMs);
  timer.unref?.();

  function write(res, event, data) {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (e) { /* the socket is gone; close handles it */ }
  }
  return {
    /** take over a request as a stream for player id; first is the state sent at once (the client refetches on every connect) */
    open(req, res, id, first, headers = {}) {
      res.writeHead(200, {
        ...headers,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      });
      res.write(': open\n\n');
      req.socket.setKeepAlive?.(true);
      req.socket.setNoDelay?.(true);
      const was = streams.get(id)?.size > 0;
      if (!streams.has(id)) streams.set(id, new Set());
      streams.get(id).add(res);
      write(res, 'state', first);
      const done = () => {
        const set = streams.get(id);
        if (!set || !set.delete(res)) return;
        onStream(false);
        if (!set.size) { streams.delete(id); onPresence(id, false); }
      };
      req.on('close', done);
      res.on('close', done);
      if (!was) onPresence(id, true);
      onStream(true);
    },
    send(id, event, data) { for (const res of streams.get(id) || []) write(res, event, data); },
    online: (id) => (streams.get(id)?.size || 0) > 0,
    ids: () => [...streams.keys()],
    /** open live streams over all players (a Present player can have several) */
    streamCount() { let n = 0; for (const set of streams.values()) n += set.size; return n; },
    /** end every stream of a player (revoked, deleted) */
    drop(id) { for (const res of streams.get(id) || []) { try { res.end(); } catch (e) { /* gone */ } } streams.delete(id); },
    close() { clearInterval(timer); for (const id of [...streams.keys()]) this.drop(id); },
  };
}
