export default function BrandMascot({ className = "" }: { className?: string }) {
  return (
    <img
      className={className}
      src="/brand/roblejam-mascot.png"
      alt="로블잼 블록 게임 마스코트"
      width={300}
      height={270}
      loading="eager"
      decoding="async"
    />
  );
}
