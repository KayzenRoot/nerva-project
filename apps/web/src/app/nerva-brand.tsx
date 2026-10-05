import Image from 'next/image';

export function NervaSymbol({ className = '' }: { readonly className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={`nerva-symbol ${className}`.trim()}
      height={1254}
      loading="eager"
      src="/branding/nerva-logo.png"
      width={1254}
    />
  );
}

export function NervaBrand() {
  return (
    <span className="nerva-logo">
      <NervaSymbol />
      <span className="sr-only">NERVA</span>
    </span>
  );
}
