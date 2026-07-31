import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/integritet")({
  head: () => ({
    meta: [
      { title: "Integritetspolicy – Donely" },
      {
        name: "description",
        content:
          "Donely lagrar all data lokalt på din enhet. Inga konton, ingen molnsynk, ingen delning mellan användare.",
      },
      { property: "og:title", content: "Integritetspolicy – Donely" },
      {
        property: "og:description",
        content: "All data i Donely stannar lokalt på din enhet.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-[15px] font-semibold text-primary">{title}</h2>
      <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-background px-5 pb-16 pt-6">
      <Link
        to="/installningar"
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        Tillbaka
      </Link>

      <h1 className="mt-4 text-[26px] font-bold tracking-tight text-foreground">
        Integritetspolicy
      </h1>
      <p className="mt-1 text-[12px] text-muted-foreground">Senast uppdaterad: 2026-07-31</p>

      <Section title="All data stannar på din enhet">
        <p>
          Donely sparar dina kategorier, registreringar, antal, årsmål och inställningar enbart
          lokalt i appens lagring på din enhet. Det finns inget användarkonto, ingen inloggning och
          ingen server som tar emot din data.
        </p>
        <p>
          Det innebär att ingen annan användare kan se dina kategorier, siffror eller statistik –
          data lämnar aldrig enheten.
        </p>
      </Section>

      <Section title="Vad vi inte samlar in">
        <p>
          Vi samlar inte in namn, e-post, plats, kontakter, annonsidentifierare eller analysdata.
          Vi säljer eller delar ingen data med tredje part.
        </p>
      </Section>

      <Section title="Köp i appen">
        <p>
          Premium hanteras av Apple via App Store. Betalningsuppgifter behandlas av Apple och delas
          aldrig med oss. Vi lagrar endast lokalt om ett köp är aktivt.
        </p>
      </Section>

      <Section title="Radera din data">
        <p>
          Du kan när som helst radera allt permanent via Inställningar → Ta bort all data. Att
          avinstallera appen tar också bort all lokal data.
        </p>
      </Section>

      <Section title="Kontakt">
        <p>Frågor om integritet: support@donely.app</p>
      </Section>

      <hr className="my-8 border-border" />

      <h2 className="text-[15px] font-semibold text-primary">Privacy Policy (English)</h2>
      <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-muted-foreground">
        <p>
          Donely stores all your categories, entries, amounts, yearly goals and settings only in
          local storage on your device. There is no account, no login and no server receiving your
          data, so no other user can ever see your data.
        </p>
        <p>
          We collect no personal data, no analytics and no advertising identifiers, and we never
          share or sell data. Premium purchases are handled by Apple; only the entitlement status is
          stored locally.
        </p>
        <p>
          You can permanently delete everything at any time via Settings → Delete all data, or by
          uninstalling the app. Questions: support@donely.app
        </p>
      </div>
    </main>
  );
}
