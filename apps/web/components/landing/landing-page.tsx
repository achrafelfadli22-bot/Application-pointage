"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  LogIn,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UsersRound,
  Workflow,
  Zap,
} from "lucide-react";
import { Pointage360Logo } from "./pointage360-logo";

const navItems = [
  { href: "#expertises", label: "Expertises" },
  { href: "#methode", label: "Methode" },
  { href: "#collaborateurs", label: "Collaborateurs" },
  { href: "#contact", label: "Contact" },
];

const contactItems = [
  {
    label: "Casablanca",
    value: "N 18 Office JAD, Bd Moulouya, El Oulfa",
    icon: MapPin,
  },
  {
    label: "Telephone",
    value: "+212 6 61 64 00 26",
    href: "tel:+212661640026",
    icon: Phone,
  },
  {
    label: "Email",
    value: "contact@futura-expert.com",
    href: "mailto:contact@futura-expert.com",
    icon: Mail,
  },
];

const metrics = [
  { value: "25+", label: "ans d'experience en ingenierie electrique" },
  { value: "HT/MT/BT", label: "etudes, dimensionnement et conformite" },
  { value: "Process", label: "organisation, tableaux de bord et performance" },
  { value: "Digital", label: "documentation, reporting et pilotage terrain" },
];

const expertises = [
  {
    title: "Ingenierie electrique",
    kicker: "Etudes et expertise",
    description:
      "Dimensionnement HT, MT et BT, harmoniques, selectivite, compensation, qualite d'energie et protection contre la foudre.",
    icon: Zap,
    accent: "text-[#F4B84A]",
    surface: "bg-[#FFF7E6]",
  },
  {
    title: "Conformite et formation",
    kicker: "Normes et securite",
    description:
      "Controle des installations, habilitations electriques et formations normatives C15-100, C14-100, C13-100 et C13-200.",
    icon: GraduationCap,
    accent: "text-[#1B3A5C]",
    surface: "bg-[#EAF2F9]",
  },
  {
    title: "Accompagnement performance",
    kicker: "Process et pilotage",
    description:
      "Diagnostic interne et externe, organisation des metiers, definition des responsabilites, objectifs et indicateurs de performance.",
    icon: BarChart3,
    accent: "text-[#3F9B80]",
    surface: "bg-[#E8F6F1]",
  },
  {
    title: "Digitalisation utile",
    kicker: "Documentation et flux",
    description:
      "Digitalisation documentaire, automatisation des reportings, gestion des flux d'information et tableaux de bord operationnels.",
    icon: Workflow,
    accent: "text-[#4A90C4]",
    surface: "bg-[#EAF5FB]",
  },
];

const methodSteps = [
  {
    title: "Diagnostiquer",
    description:
      "Identifier les forces, faiblesses, risques et opportunites avant de choisir les leviers d'action.",
  },
  {
    title: "Structurer",
    description:
      "Clarifier les process, les responsabilites, les postes de travail et les projets structurants.",
  },
  {
    title: "Former",
    description:
      "Renforcer les competences techniques, manageriales et normatives des equipes concernees.",
  },
  {
    title: "Digitaliser",
    description:
      "Installer des outils simples pour tracer, reporter, mesurer et prendre les bonnes decisions.",
  },
];

const collaboratorModules = [
  "Connexion collaborateurs Futura",
  "Pointage terrain et bureau",
  "Timesheets par projet et chantier",
  "Demandes de conges et validations N+1/N+2",
  "Reporting interne pour les managers",
];

function FuturaExpertiseLogo({ tone = "light" }: { tone?: "light" | "dark" }) {
  const isLight = tone === "light";
  return (
    <div className="flex items-center gap-3">
      <div
        className={[
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-sm font-semibold",
          isLight
            ? "border-white/25 bg-white/10 text-white"
            : "border-[#C9D8E6] bg-[#102238] text-white",
        ].join(" ")}
      >
        FE
      </div>
      <div className="leading-none">
        <div className={isLight ? "text-xl font-semibold text-white" : "text-xl font-semibold text-[#102238]"}>
          Futura Expertise
        </div>
        <div className={isLight ? "mt-1 text-xs font-semibold text-white/60" : "mt-1 text-xs font-semibold text-[#6B7A99]"}>
          Ingenierie, formation et accompagnement
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const year = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    document.documentElement.classList.add("motion-ready");

    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );

    document.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      observer.disconnect();
      document.documentElement.classList.remove("motion-ready");
    };
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F3F7FB] text-[#24364A]">
      <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-white/10">
        <div className="h-full bg-[#F4B84A] transition-[width] duration-150" style={{ width: `${scrollProgress * 100}%` }} />
      </div>

      <header className="fixed left-0 right-0 top-1 z-40 border-b border-white/15 bg-[#102238]/95 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Accueil Futura Expertise">
            <FuturaExpertiseLogo />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-white/75 lg:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-[#102238] shadow-card transition hover:bg-[#F3F7FB]"
          >
            <LogIn className="h-4 w-4" />
            Espace collaborateurs
          </Link>
        </div>
      </header>

      <section className="relative min-h-[92svh] overflow-hidden bg-[#102238] pt-24 text-white">
        <Image
          src="/images/futura-expertise-hero.jpg"
          alt="Ingenierie electrique et pilotage digital Futura Expertise"
          fill
          priority
          className="landing-hero-image object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#102238]/28" />
        <div className="absolute inset-y-0 left-0 w-full bg-[#102238]/90 lg:w-[57%] lg:bg-[#102238]/95" />
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-[#F3F7FB]" />

        <div className="relative mx-auto grid min-h-[calc(92svh-6rem)] max-w-7xl items-center px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div className="max-w-2xl" data-reveal>
            <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white/90">
              <ShieldCheck className="h-4 w-4 text-[#F4B84A]" />
              Votre accompagnateur vers la performance
            </div>
            <h1 className="mt-8 max-w-3xl text-5xl font-semibold leading-[1.03] text-white sm:text-6xl lg:text-7xl">
              Futura Expertise
            </h1>
            <p className="mt-6 max-w-xl text-xl font-semibold leading-8 text-white/90">
              Ingenierie electrique, formation et accompagnement pour mieux structurer, mesurer et piloter votre activite.
            </p>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/70">
              Depuis Casablanca, Futura Expertise accompagne les entreprises dans leurs etudes electriques, leur conformite, leur organisation interne, leurs tableaux de bord et leur digitalisation.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#F4B84A] px-6 text-sm font-semibold text-[#102238] shadow-card transition hover:bg-[#FFD36B]"
              >
                Connexion collaborateurs
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              <a
                href="#expertises"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/30 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Voir les expertises
                <CheckCircle2 className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="hidden lg:flex lg:justify-end" data-reveal data-delay="2">
            <div className="w-full max-w-md rounded-lg border border-white/20 bg-[#102238]/85 p-5 text-white shadow-dropdown backdrop-blur-md landing-float-panel">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <div>
                  <div className="text-xs font-semibold uppercase text-white/60">Portail interne</div>
                  <div className="mt-1 text-xl font-semibold">Pointage Futura</div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#F4B84A] text-[#102238]">
                  <LogIn className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {collaboratorModules.slice(0, 4).map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-6 text-white/80">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#5BC2A7]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/login"
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-[#102238] transition hover:bg-[#F3F7FB]"
              >
                Ouvrir l'application
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative -mt-8 border-b border-[#D3DFEA]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid overflow-hidden rounded-lg border border-[#D3DFEA] bg-white shadow-card md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric, index) => (
              <div
                key={metric.label}
                className="border-b border-[#D3DFEA] p-6 last:border-b-0 md:border-r md:last:border-r-0 xl:border-b-0"
                data-reveal
                data-delay={index}
              >
                <div className="text-3xl font-semibold text-[#102238]">{metric.value}</div>
                <div className="mt-2 text-sm leading-6 text-[#5E7087]">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="expertises" className="bg-[#F3F7FB]">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div data-reveal>
              <p className="text-sm font-semibold uppercase text-[#2A5080]">Domaines d'intervention</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight text-[#102238]">
                Une expertise technique et organisationnelle au service de la performance.
              </h2>
            </div>
            <p className="text-base leading-7 text-[#5E7087]" data-reveal data-delay="1">
              Futura Expertise relie le terrain, les normes, les process et les outils de pilotage. L'objectif est simple : rendre l'entreprise plus claire, plus mesurable et plus robuste dans son execution.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {expertises.map((item, index) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="min-h-[292px] rounded-lg border border-[#D3DFEA] bg-white p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:border-[#AFC0D2] hover:shadow-cardHover"
                  data-reveal
                  data-delay={index}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-md ${item.surface} ${item.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-6 text-xs font-semibold uppercase text-[#6B7A99]">{item.kicker}</div>
                  <h3 className="mt-2 text-xl font-semibold text-[#102238]">{item.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-[#5E7087]">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="methode" className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[420px_1fr] lg:px-8">
          <div className="lg:sticky lg:top-28 lg:self-start" data-reveal>
            <p className="text-sm font-semibold uppercase text-[#2A5080]">Methode Futura</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight text-[#102238]">
              Du diagnostic aux tableaux de bord, sans perdre le terrain de vue.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#5E7087]">
              Les missions sont construites pour clarifier les responsabilites, fiabiliser les donnees et donner aux equipes des outils vraiment utilisables.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {methodSteps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-lg border border-[#D3DFEA] bg-[#F8FBFE] p-6"
                data-reveal
                data-delay={index}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#102238] text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-xl font-semibold text-[#102238]">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#5E7087]">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="collaborateurs" className="bg-[#102238] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div data-reveal>
            <p className="text-sm font-semibold uppercase text-[#F4B84A]">Application interne</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight">
              Pointage devient l'espace de connexion des collaborateurs Futura.
            </h2>
            <p className="mt-5 text-base leading-7 text-white/70">
              Les collaborateurs se connectent a Pointage pour declarer leurs heures, suivre leurs affectations, remplir les timesheets, demander un conge et transmettre les donnees necessaires aux managers.
            </p>
            <div className="mt-8 space-y-3">
              {collaboratorModules.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm leading-6 text-white/80">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#5BC2A7]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <Link
              href="/login"
              className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#F4B84A] px-6 text-sm font-semibold text-[#102238] transition hover:bg-[#FFD36B]"
            >
              Acceder a Pointage
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-white/15 bg-white shadow-dropdown" data-reveal data-delay="1">
            <Image
              src="/images/landing-hero-pointage360.png"
              alt="Application Pointage pour les collaborateurs Futura"
              fill
              className="object-cover object-left-top"
              sizes="(min-width: 1024px) 54vw, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#102238]/55 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 rounded-md bg-white/90 p-4 text-[#102238] shadow-card backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <Pointage360Logo tone="dark" />
                <div className="hidden items-center gap-2 text-sm font-semibold text-[#3F9B80] sm:flex">
                  <ShieldCheck className="h-4 w-4" />
                  Acces securise
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#D3DFEA] bg-[#F3F7FB]">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="max-w-3xl" data-reveal>
            <p className="text-sm font-semibold uppercase text-[#2A5080]">Ce que Futura apporte</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight text-[#102238]">
              Une entreprise mieux organisee, des donnees plus fiables, des decisions plus rapides.
            </h2>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              {
                title: "Responsabilites claires",
                description: "Definition des missions, repartition des objectifs et organisation des postes de travail.",
                icon: UsersRound,
              },
              {
                title: "Conformite maitrisee",
                description: "Etudes, controles, normes electriques, securite et preparation des certifications.",
                icon: FileCheck2,
              },
              {
                title: "Pilotage mesurable",
                description: "Indicateurs, reportings automatises et tableaux de bord pour suivre la performance.",
                icon: ClipboardCheck,
              },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-lg border border-[#D3DFEA] bg-white p-7 shadow-card" data-reveal data-delay={index}>
                  <Icon className="h-8 w-8 text-[#4A90C4]" />
                  <h3 className="mt-6 text-xl font-semibold text-[#102238]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#5E7087]">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="contact" className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8">
          <div data-reveal>
            <p className="text-sm font-semibold uppercase text-[#2A5080]">Contact</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight text-[#102238]">
              Parlez a Futura Expertise ou connectez-vous a l'espace collaborateurs.
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[#5E7087]">
              La page publique presente Futura Expertise. L'application Pointage reste l'espace reserve aux collaborateurs de Futura pour les operations quotidiennes.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#102238] px-6 text-sm font-semibold text-white transition hover:bg-[#1B3A5C]"
              >
                Espace collaborateurs
                <LogIn className="h-4 w-4" />
              </Link>
              <a
                href="mailto:contact@futura-expert.com"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[#C9D8E6] px-6 text-sm font-semibold text-[#102238] transition hover:bg-[#F3F7FB]"
              >
                Contacter Futura
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-[#D3DFEA] bg-[#F8FBFE] p-6 shadow-card" data-reveal data-delay="1">
            <FuturaExpertiseLogo tone="dark" />
            <div className="mt-6 space-y-4">
              {contactItems.map((item) => {
                const Icon = item.icon;
                const content = (
                  <div className="flex gap-3 rounded-md border border-[#D3DFEA] bg-white p-4">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#4A90C4]" />
                    <div>
                      <div className="text-xs font-semibold uppercase text-[#6B7A99]">{item.label}</div>
                      <div className="mt-1 text-sm font-semibold leading-6 text-[#102238]">{item.value}</div>
                    </div>
                  </div>
                );

                return item.href ? (
                  <a key={item.label} href={item.href} className="block">
                    {content}
                  </a>
                ) : (
                  <div key={item.label}>{content}</div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#102238] py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <FuturaExpertiseLogo />
          <div className="text-sm text-white/60">
            &copy; {year} Futura Expertise. Pointage est l'espace collaborateurs interne.
          </div>
        </div>
      </footer>
    </main>
  );
}
