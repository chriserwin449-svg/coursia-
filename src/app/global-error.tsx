"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body>
        <div className="min-h-screen bg-night flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-6">🔥</div>
            <h1 className="text-2xl font-bold text-white mb-3">
              Erreur critique
            </h1>
            <p className="text-gray-400 text-sm mb-2">
              {error.message || "L'application a rencontré une erreur grave."}
            </p>
            {error.digest && (
              <p className="text-xs text-gray-500 mb-4">
                Error ID: {error.digest}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <button
                onClick={reset}
                className="px-6 py-3 rounded-full bg-purple-600 text-white font-bold hover:bg-purple-500 transition-all cursor-pointer"
              >
                Réessayer
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="px-6 py-3 rounded-full bg-white/10 border border-white/20 text-white font-bold hover:bg-white/20 transition-all cursor-pointer"
              >
                Retour à l&apos;accueil
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
