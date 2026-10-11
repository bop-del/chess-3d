// The live stream of online play (CHE-271): Server-Sent Events over a plain HTTP response. A player is present while at least one
// stream of theirs is open. Every event is `state` with the same shape as GET /state; a comment line every 20 s keeps proxies
// (kamal-proxy, nginx) from closing an idle stream. The transport lives here and in src/online/api.js only, so a later switch to
// WebSocket touches these two files.
export function createLive({ heartbeatMs = 20000, onPresence = () => {}, onBeat = () => {}, onStream = () => {} } = {}) {
  const streams = new Map();   // player id -> Set of responses
  const sids = new Map();      // CHE-437: response -> the client's stream id (absent: an old client, counts as visible)
  const hidden = new Map();    // CHE-437: player id -> Map(sid -> when the tab went hidden)
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
    open(req, res, id, first, headers = {}, sid = '') {
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
      if (sid) sids.set(res, sid);
      write(res, 'state', first);
      const done = () => {
        const set = streams.get(id);
        if (!set || !set.delete(res)) return;
        sids.delete(res);
        onStream(false);
        if (!set.size) { streams.delete(id); hidden.delete(id); onPresence(id, false); }
      };
      req.on('close', done);
      res.on('close', done);
      if (!was) onPresence(id, true);
      onStream(true);
    },
    send(id, event, data) { for (const res of streams.get(id) || []) write(res, event, data); },
    /** CHE-437: the tab of stream sid went hidden (at = when) or visible again */
    setHidden(id, sid, isHidden, at) {
      if (!sid) return;
      if (!hidden.has(id)) hidden.set(id, new Map());
      const m = hidden.get(id);
      if (isHidden) { if (!m.has(sid)) m.set(sid, at); } else m.delete(sid);
    },
    /** CHE-437: is any stream of the player in a visible tab, or hidden for less than graceMs? None open: false. A push goes out when this is false. */
    visible(id, at, graceMs = 30000) {
      for (const res of streams.get(id) || []) {
        const since = sids.has(res) ? hidden.get(id)?.get(sids.get(res)) : undefined;
        if (since == null || at - since < graceMs) return true;
      }
      return false;
    },
    online: (id) => (streams.get(id)?.size || 0) > 0,
    ids: () => [...streams.keys()],
    /** open live streams over all players (a Present player can have several) */
    streamCount() { let n = 0; for (const set of streams.values()) n += set.size; return n; },
    /** end every stream of a player (revoked, deleted) */
    drop(id) { for (const res of streams.get(id) || []) { try { res.end(); } catch (e) { /* gone */ } } streams.delete(id); },
    close() { clearInterval(timer); for (const id of [...streams.keys()]) this.drop(id); },
  };
}
