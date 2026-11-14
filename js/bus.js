// A tiny event bus: SMD.bus.on(name, fn) returns an unsubscribe function.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const handlers = {};
  SMD.bus = {
    on(name, fn) {
      (handlers[name] = handlers[name] || []).push(fn);
      return () => (handlers[name] = (handlers[name] || []).filter((f) => f !== fn));
    },
    emit(name, payload) {
      (handlers[name] || []).slice().forEach((fn) => {
        try {
          fn(payload);
        } catch (e) {
          console.error(e);
        }
      });
    },
  };
})();
