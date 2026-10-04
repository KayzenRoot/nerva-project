export function NervaSymbol({ className = '' }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`nerva-symbol ${className}`.trim()}
      fill="none"
      viewBox="0 0 48 48"
    >
      <path className="nerva-symbol-shell" d="M24 3.75 42 14v20L24 44.25 6 34V14L24 3.75Z" />
      <path className="nerva-symbol-letter" d="M16 32V16l16 16V16" />
      <path className="nerva-symbol-node" d="M16 16h5" />
    </svg>
  );
}

export function NervaBrand() {
  return (
    <span className="nerva-logo">
      <NervaSymbol />
      <span className="nerva-wordmark">NERVA</span>
      <span className="nerva-logo-signal" aria-hidden="true" />
    </span>
  );
}
