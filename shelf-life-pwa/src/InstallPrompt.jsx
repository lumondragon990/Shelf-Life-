// InstallPrompt.jsx — drop this component into your deployed Shelf Life app.
// Shows a gentle "Add Shelf Life to your home screen" banner when the browser
// says the app is installable (Chrome/Edge/Android), and iOS-specific
// instructions on iPhone/iPad (Safari has no install event — you have to tell
// people to use Share → Add to Home Screen).

import { useState, useEffect } from "react";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    // Already installed? Don't nag.
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const onPrompt = (e) => {
      e.preventDefault(); // stop Chrome's mini-infobar
      setDeferred(e);     // save it so our own button can trigger it
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone || dismissed) return null;
  if (!deferred && !isIOS) return null;

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice; // { outcome: "accepted" | "dismissed" }
    setDeferred(null);
  };

  return (
    <div style={{
      position: "fixed", bottom: 16, left: 16, right: 16, zIndex: 100,
      maxWidth: 440, margin: "0 auto",
      background: "#FCF9F0", border: "1.5px solid #C3CFE0", borderLeft: "5px solid #3E7C59",
      borderRadius: 12, padding: "12px 16px", boxShadow: "0 6px 20px rgba(34,51,77,0.18)",
      fontFamily: "'Atkinson Hyperlegible', sans-serif", color: "#22334D",
    }}>
      <strong>📚 Keep Shelf Life on your home screen</strong>
      <p style={{ margin: "4px 0 10px", fontSize: 14 }}>
        {isIOS
          ? <>Tap the <strong>Share</strong> button, then <strong>"Add to Home Screen"</strong> — it'll open like a regular app.</>
          : "One tap and it opens like a regular app — no app store needed."}
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        {!isIOS && (
          <button onClick={install} style={{
            background: "#3E7C59", color: "#fff", border: "none", borderRadius: 8,
            padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 14,
          }}>
            Add to home screen
          </button>
        )}
        <button onClick={() => setDismissed(true)} style={{
          background: "transparent", color: "#5A6B85", border: "none",
          padding: "8px 10px", cursor: "pointer", fontSize: 14,
        }}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
