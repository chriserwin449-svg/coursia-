"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ErrorBoundary] Caught error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-night flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Une erreur est survenue
        </h1>
        <p className="text-muted-foreground text-sm mb-2">
          {error.message || "Un problème inattendu s'est produit."}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 mb-4">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-mauve to-mauve-dark text-white font-bold hover:from-mauve-light hover:to-mauve transition-all cursor-pointer"
          >
            Réessayer
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="px-6 py-3 rounded-full bg-white/5 border border-border text-foreground font-bold hover:bg-white/10 transition-all cursor-pointer"
          >
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    </div>
  );
}
