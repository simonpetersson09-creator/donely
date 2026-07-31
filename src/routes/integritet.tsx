import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useLanguage } from "@/lib/use-language";

export const Route = createFileRoute("/integritet")({
  head: () => ({
    meta: [
      { title: "Integritetspolicy & Användarvillkor – Donely" },
      {
        name: "description",
        content:
          "Donelys integritetspolicy och användarvillkor på samma sida: lokal datalagring, inga konton och villkor för Premium-abonnemanget.",
      },
      { property: "og:title", content: "Integritetspolicy & Användarvillkor – Donely" },
      {
        property: "og:description",
        content: "All data i Donely stannar lokalt på din enhet. Läs policy och villkor.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Legal,
});

function Section({ id, title, body }: { id?: string; title: string; body: string }) {
  return (
    <section id={id} className="mt-5 scroll-mt-6">
      <h3 className="text-[15px] font-semibold leading-[20px] text-foreground">{title}</h3>
      <p className="mt-1.5 text-[13px] font-normal leading-[19px] text-muted-foreground">{body}</p>
    </section>
  );
}

function Legal() {
  const { t } = useLanguage();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-[calc(env(safe-area-inset-top)+0.5rem)] md:px-8">
      <div className="py-2">
        <Link
          to="/installningar"
          className="-ml-2 inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] font-normal leading-[18px] text-primary transition-colors active:bg-secondary"
        >
          <ChevronLeft className="size-4" />
          {t("back")}
        </Link>
      </div>

      <h1 className="px-1 text-[26px] font-bold leading-[32px] tracking-[-0.03em] text-primary md:text-[32px] md:leading-[38px]">
        {t("legalPageTitle")}
      </h1>
      <p className="mt-1 px-1 text-[12px] font-normal leading-[17px] text-muted-foreground">
        {t("legalUpdated")}
      </p>
      <p className="mt-3 px-1 text-[13px] font-normal leading-[19px] text-muted-foreground">
        {t("legalIntro")}
      </p>

      <nav className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {t("legalTocTitle")}
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          <a href="#privacy" className="text-[14px] font-semibold leading-[19px] text-primary">
            1. {t("legalPrivacyTitle")}
          </a>
          <a href="#terms" className="text-[14px] font-semibold leading-[19px] text-primary">
            2. {t("legalTermsTitle")}
          </a>
        </div>
      </nav>

      <div id="privacy" className="mt-8 scroll-mt-6">
        <h2 className="text-[20px] font-bold leading-[26px] tracking-[-0.02em] text-primary">
          {t("legalPrivacyTitle")}
        </h2>
        <Section title={t("p1t")} body={t("p1b")} />
        <Section title={t("p2t")} body={t("p2b")} />
        <Section title={t("p3t")} body={t("p3b")} />
        <Section title={t("p4t")} body={t("p4b")} />
        <Section title={t("p5t")} body={t("p5b")} />
      </div>

      <hr className="my-8 border-border" />

      <div id="terms" className="scroll-mt-6">
        <h2 className="text-[20px] font-bold leading-[26px] tracking-[-0.02em] text-primary">
          {t("legalTermsTitle")}
        </h2>
        <Section title={t("t1t")} body={t("t1b")} />
        <Section title={t("t2t")} body={t("t2b")} />
        <Section title={t("t3t")} body={t("t3b")} />
        <Section title={t("t4t")} body={t("t4b")} />
        <Section title={t("t5t")} body={t("t5b")} />
      </div>

      <p className="mt-8 text-[12px] font-normal leading-[17px] text-muted-foreground">
        {t("legalContactNote")}
      </p>
      <p className="mt-2 text-[9px] font-normal leading-[13px] text-muted-foreground/80">
        Donely · {t("version")} 1.0
      </p>
    </main>
  );
}
