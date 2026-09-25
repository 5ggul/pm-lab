export default function BrandMascot({ className = "" }: { className?: string }) {
  return (
    <picture>
      <source srcSet="/brand/roblejam-avatar-v2.svg" type="image/svg+xml" />
      <img
        className={className}
        src="/brand/roblejam-mascot.webp"
        alt="로블잼 블루 게이머 마스코트"
        width={120}
        height={108}
        loading="eager"
        decoding="async"
      />
    </picture>
  );
}
