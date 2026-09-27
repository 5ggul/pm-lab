// Operator-supplied verified destination only; never derive a mailbox from brand.
export function privateContact(env: Record<string, string | undefined> = process.env): { href:string; label:string } | null {
  if (env.R1_PRIVATE_CONTACT_VERIFIED !== "1") return null;
  const email = env.R1_PRIVATE_CONTACT_EMAIL?.trim();
  if (email && /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return {href:"mailto:"+encodeURIComponent(email),label:"비공개 문의 이메일"};
  try {
    const url = new URL(env.R1_PRIVATE_CONTACT_URL ?? "");
    if (url.protocol === "https:" && !url.username && !url.password && !["github.com","www.github.com"].includes(url.hostname)) return {href:url.href,label:"비공개 문의"};
  } catch {}
  return null;
}
