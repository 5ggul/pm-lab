export default function BrandMascot({ className = "" }: { className?: string }) {
  return (
    <img
      className={className}
      src="/brand/roblejam-mascot.webp"
      alt="로블잼 블록 게임 마스코트"
      width={120}
      height={108}
      loading="eager"
      decoding="async"
    />
  );
}
