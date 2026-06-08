"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  LogIn,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
  Zap,
} from "lucide-react";
import { Pointage360Logo } from "./pointage360-logo";

const navItems = [
  { href: "#services", label: "Services" },
  { href: "#expertise", label: "Expertise" },
  { href: "#formation", label: "Formation" },
  { href: "#pointage", label: "Pointage" },
  { href: "#contact", label: "Contact" },
];

const heroStats = [
  { value: "25+", label: "Ans d'experience" },
  { value: "4", label: "Poles d'expertise" },
  { value: "100%", label: "Engagement terrain" },
];

const services = [
  {
    name: "Expertise electrique",
    icon: Zap,
    items: [
      "Dimensionnement HT/MT/BT",
      "Etude des harmoniques",
      "Selectivite et protections",
      "Compensation reactive",
      "Controle de conformite",
    ],
  },
  {
    name: "Formation technique",
    icon: GraduationCap,
    items: [
      "Normes C15-100 et C14-100",
      "Regimes du neutre",
      "Courants de court-circuit",
      "Protection contre la foudre",
      "Habilitations electriques",
    ],
  },
  {
    name: "Bureaux d'etudes",
    icon: ClipboardCheck,
    items: [
      "Restructuration organisationnelle",
      "Process metiers",
      "Tableaux de bord",
      "Gestion des competences",
      "Digitalisation documentaire",
    ],
  },
  {
    name: "Analyse strategique",
    icon: BarChart3,
    items: [
      "Diagnostic interne",
      "Diagnostic externe",
      "Analyse SWOT",
      "Projets structurants",
      "Indicateurs de performance",
    ],
  },
  {
    name: "Capital humain",
    icon: UsersRound,
    items: [
      "Missions et responsabilites",
      "Ingenierie de formation",
      "Motivation des equipes",
      "Climat de travail",
      "Equilibre pro/personnel",
    ],
  },
  {
    name: "Process et digital",
    icon: Workflow,
    items: [
      "Flux d'information",
      "Automatisation reporting",
      "Pointage terrain",
      "Timesheets projet",
      "Validation N+1/N+2",
    ],
  },
];

const expertiseItems = [
  {
    title: "Installations haute et basse tension",
    description: "Etudes completes de dimensionnement, verification de conformite et optimisation HT/MT/BT.",
    icon: Zap,
  },
  {
    title: "Qualite de l'energie",
    description: "Analyse des harmoniques, compensation d'energie reactive et efficacite energetique.",
    icon: BarChart3,
  },
  {
    title: "Protection et normes",
    description: "Selectivite, choix des protections, protection foudre et controle des installations.",
    icon: ShieldCheck,
  },
  {
    title: "Performance organisationnelle",
    description: "Restructuration, responsabilites, indicateurs et pilotage durable de l'entreprise.",
    icon: ClipboardCheck,
  },
];

const formationTopics = [
  "NF C 15-100",
  "C 14-100",
  "C 13-100",
  "C 13-200",
  "Regimes du neutre",
  "Courants de court-circuit",
  "Choix des protections",
  "Dimensionnement canalisations",
  "Qualite d'energie",
  "Protection foudre",
];

const accompCards = [
  {
    title: "Analyse strategique",
    icon: Sparkles,
    items: ["Diagnostic interne", "Diagnostic externe", "Analyse SWOT", "Projets structurants"],
  },
  {
    title: "Gestion des performances",
    icon: BarChart3,
    items: ["Tableaux de bord", "KPIs metiers", "Definition des objectifs", "Suivi et pilotage"],
  },
  {
    title: "Capital humain",
    icon: UsersRound,
    items: ["Ingenierie de formation", "Gestion des competences", "Motivation", "Climat de travail"],
  },
  {
    title: "Process et digital",
    icon: Workflow,
    items: ["Organisation metiers", "Definition process", "Documentation digitale", "Reporting automatise"],
  },
];

const pointageModules = [
  "Connexion collaborateurs Futura",
  "Pointage terrain et bureau",
  "Timesheets par projet et chantier",
  "Demandes de conges",
  "Validation N+1 et N+2",
  "Rapports managers et RH",
];

const contactItems = [
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
  {
    label: "Adresse",
    value: "N 18 Office JAD, Bd Moulouya, El Oulfa, Casablanca",
    icon: MapPin,
  },
];

function FuturaLogo({ light = false }: { light?: boolean }) {
  return (
    <div className="leading-none">
      <div className={`landing-serif text-3xl font-semibold tracking-[-0.02em] ${light ? "text-white" : "text-[#0D1B2A]"}`}>
        Futura
      </div>
      <div className={`mt-[-2px] text-[10px] font-bold uppercase tracking-[0.28em] ${light ? "text-[#6EE3E0]" : "text-[#0ABFBC]"}`}>
        Expertise
      </div>
    </div>
  );
}

export function LandingPage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const year = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    document.documentElement.classList.add("motion-ready");

    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      setScrolled(window.scrollY > 20);
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
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
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
    <main className="min-h-screen overflow-x-hidden bg-white text-[#0D1B2A]">
      <div className="fixed left-0 right-0 top-0 z-[90] h-1 bg-[#E0F7F8]">
        <div className="h-full bg-[#0ABFBC] transition-[width] duration-150" style={{ width: `${scrollProgress * 100}%` }} />
      </div>

      <header
        className={[
          "fixed left-0 right-0 top-1 z-[80] border-b border-[#0ABFBC]/[0.15] bg-white/[0.96] backdrop-blur-xl transition-shadow",
          scrolled ? "shadow-[0_16px_40px_rgba(13,27,42,0.08)]" : "",
        ].join(" ")}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" aria-label="Accueil Futura Expertise">
            <FuturaLogo />
          </a>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-[#3D5166] lg:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="transition hover:text-[#0ABFBC]">
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href="/login"
            className="inline-flex h-10 items-center gap-2 rounded-sm bg-[#0ABFBC] px-4 text-sm font-bold uppercase tracking-wide text-white transition hover:-translate-y-0.5 hover:bg-[#0891A2]"
          >
            <LogIn className="h-4 w-4" />
            Collaborateurs
          </a>
        </div>
      </header>

      <section className="relative flex min-h-screen items-center overflow-hidden pt-20 text-white">
        <Image
          src="/images/futura-expertise-hero.jpg"
          alt="Technicien en intervention electrique"
          fill
          priority
          className="landing-hero-image object-cover object-center brightness-[0.42]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(2,12,24,0.96)_0%,rgba(13,27,42,0.88)_38%,rgba(8,145,162,0.36)_72%,rgba(13,27,42,0.18)_100%)]" />
        <div className="absolute left-0 top-0 z-[5] h-full w-[62%] bg-[linear-gradient(90deg,rgba(2,12,24,0.9)_0%,rgba(2,12,24,0.68)_62%,transparent_100%)]" />

        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="landing-hero-copy max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-sm border border-[#0ABFBC]/[0.45] bg-[#0ABFBC]/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#67E4E1] backdrop-blur">
                <span className="landing-teal-dot" />
                Bureau d'etudes - Casablanca, Maroc
              </div>
              <h1 className="landing-serif mt-8 max-w-4xl text-5xl font-light leading-[1.06] text-white sm:text-6xl lg:text-7xl">
                Votre partenaire en <span className="italic text-[#67E4E1]">ingenierie electrique</span>{" "}
                <strong className="font-semibold">& performance</strong>
              </h1>
              <p className="mt-6 max-w-2xl text-lg font-light leading-8 text-white/75">
                Plus de 25 ans d'experience au service de votre ingenierie electrique, de votre formation et de votre performance organisationnelle.
              </p>

              <div className="mt-9 flex flex-wrap gap-8">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="border-l-2 border-[#0ABFBC] pl-5">
                    <div className="landing-serif text-5xl font-semibold leading-none text-[#67E4E1]">{stat.value}</div>
                    <div className="mt-1 text-xs font-bold uppercase tracking-wide text-white/[0.55]">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#services"
                  className="inline-flex h-[52px] items-center justify-center rounded-sm border-2 border-[#0ABFBC] bg-[#0ABFBC] px-8 text-sm font-bold uppercase tracking-wide text-white transition hover:-translate-y-1 hover:bg-[#0891A2]"
                >
                  Decouvrir nos services
                </a>
                <a
                  href="/login"
                  className="inline-flex h-[52px] items-center justify-center gap-2 rounded-sm border-2 border-white/[0.45] px-8 text-sm font-semibold text-white transition hover:-translate-y-1 hover:bg-white/10"
                >
                  Espace Pointage
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/[0.45] md:flex">
          <div className="landing-scroll-line" />
          Scroll
        </div>
      </section>

      <section id="services" className="bg-[#F2F7FA] px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 flex flex-col justify-between gap-6 lg:flex-row lg:items-end" data-reveal>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#0ABFBC]">Ce que nous faisons</div>
              <h2 className="landing-serif mt-3 text-4xl font-light leading-tight text-[#0D1B2A] sm:text-5xl">
                Nos <strong className="font-semibold">poles de services</strong>
              </h2>
            </div>
            <p className="max-w-xl text-base font-light leading-8 text-[#3D5166]">
              Une offre integree couvrant l'ingenierie electrique, la formation, l'accompagnement strategique et la digitalisation des operations.
            </p>
          </div>

          <div className="grid border border-[#0ABFBC]/10 bg-[#0ABFBC]/10 md:grid-cols-2 lg:grid-cols-3" data-reveal>
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.name}
                  className="group relative min-h-[330px] overflow-hidden bg-white p-8 transition hover:-translate-y-1 hover:bg-[#FAFFFE] hover:shadow-[0_24px_60px_rgba(10,191,188,0.13)]"
                >
                  <div className="absolute bottom-0 left-0 h-1 w-0 bg-[#0ABFBC] transition-all duration-500 group-hover:w-full" />
                  <div className="landing-serif text-6xl font-light leading-none text-[#0ABFBC]/[0.15] transition group-hover:text-[#0ABFBC]/30">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#E0F7F8] text-[#0891A2]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0D1B2A]">{service.name}</h3>
                  </div>
                  <ul className="mt-6 space-y-2">
                    {service.items.map((item) => (
                      <li key={item} className="flex gap-3 border-b border-black/5 pb-2 text-sm leading-6 text-[#3D5166] last:border-b-0">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0ABFBC]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="expertise" className="grid min-h-[640px] bg-white lg:grid-cols-2">
        <div className="relative min-h-[340px] overflow-hidden lg:min-h-full">
          <Image
            src="/images/futura-expertise-hero.png"
            alt="Expertise terrain Futura"
            fill
            className="object-cover object-center"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_45%,rgba(255,255,255,0.92)_100%)]" />
        </div>
        <div className="flex flex-col justify-center px-4 py-20 sm:px-8 lg:px-14" data-reveal>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#0ABFBC]">Notre expertise technique</div>
          <h2 className="landing-serif mt-3 text-4xl font-light leading-tight text-[#0D1B2A] sm:text-5xl">
            25 ans au service de <strong className="font-semibold">votre ingenierie</strong>
          </h2>
          <p className="mt-5 max-w-xl text-base font-light leading-8 text-[#3D5166]">
            Futura Expertise accompagne les entreprises dans la maitrise de leurs installations electriques et l'optimisation de leurs performances.
          </p>
          <div className="mt-8 grid gap-3">
            {expertiseItems.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="group flex gap-4 border-l-4 border-transparent p-4 transition hover:border-[#0ABFBC] hover:bg-[#E0F7F8]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#E0F7F8] text-[#0891A2] transition group-hover:bg-[#0ABFBC] group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#0D1B2A]">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#3D5166]">{item.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="formation" className="grid min-h-[620px] bg-[#F2F7FA] lg:grid-cols-2">
        <div className="flex flex-col justify-center px-4 py-20 sm:px-8 lg:px-16" data-reveal>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#0ABFBC]">Formation</div>
          <h2 className="landing-serif mt-3 text-4xl font-light leading-tight text-[#0D1B2A] sm:text-5xl">
            Formations <strong className="font-semibold">normatives</strong> & techniques
          </h2>
          <p className="mt-5 max-w-xl text-base font-light leading-8 text-[#3D5166]">
            Des formations adaptees aux professionnels de l'electricite, pour maitriser les normes et les bonnes pratiques.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {formationTopics.slice(0, 4).map((topic) => (
              <span key={topic} className="rounded-sm bg-[#0ABFBC] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
                {topic}
              </span>
            ))}
          </div>
          <div className="mt-8 grid gap-2 sm:grid-cols-2">
            {formationTopics.slice(4).map((topic) => (
              <div key={topic} className="flex items-center gap-2 rounded border border-[#0ABFBC]/20 bg-white px-3 py-2 text-sm text-[#3D5166] transition hover:border-[#0ABFBC] hover:bg-[#E0F7F8]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0ABFBC]" />
                {topic}
              </div>
            ))}
          </div>
        </div>
        <div className="relative min-h-[340px] overflow-hidden lg:min-h-full">
          <Image
            src="/images/futura-expertise-hero.jpg"
            alt="Formation et intervention technique"
            fill
            className="object-cover object-center"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(270deg,rgba(13,27,42,0.04),rgba(242,247,250,0.98)_100%)]" />
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#0D1B2A] px-4 py-24 text-white sm:px-6 lg:px-8">
        <Image
          src="/images/landing-hero-pointage360.png"
          alt="Pilotage et tableaux de bord"
          fill
          className="object-cover opacity-[0.08] grayscale"
          sizes="100vw"
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-3xl text-center" data-reveal>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#0ABFBC]">Accompagnement managerial</div>
            <h2 className="landing-serif mt-3 text-4xl font-light leading-tight text-white sm:text-5xl">
              Prendre le <strong className="font-semibold">controle</strong> de votre entreprise
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base font-light leading-8 text-white/60">
              Notre mission : vous aider a piloter votre organisation avec clarte, efficacite et performance durable.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4" data-reveal>
            {accompCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="rounded-lg border border-white/10 bg-white/[0.05] p-6 transition hover:-translate-y-1 hover:border-[#0ABFBC]/[0.45] hover:bg-[#0ABFBC]/[0.12]">
                  <Icon className="h-9 w-9 text-[#67E4E1]" />
                  <h3 className="mt-5 text-lg font-bold text-white">{card.title}</h3>
                  <ul className="mt-5 space-y-2">
                    {card.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-white/[0.55]">
                        <ArrowRight className="h-3.5 w-3.5 text-[#0ABFBC]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pointage" className="grid bg-white lg:grid-cols-[1fr_1.08fr]">
        <div className="flex flex-col justify-center px-4 py-24 sm:px-8 lg:px-16" data-reveal>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#0ABFBC]">Application collaborateurs</div>
          <h2 className="landing-serif mt-3 text-4xl font-light leading-tight text-[#0D1B2A] sm:text-5xl">
            Pointage devient l'espace de connexion des <strong className="font-semibold">collaborateurs Futura</strong>
          </h2>
          <p className="mt-5 max-w-xl text-base font-light leading-8 text-[#3D5166]">
            Les collaborateurs se connectent a Pointage pour declarer leurs heures, suivre leurs affectations, remplir leurs timesheets et transmettre les donnees necessaires aux managers.
          </p>
          <div className="mt-8 grid gap-3">
            {pointageModules.map((module) => (
              <div key={module} className="flex items-center gap-3 text-sm font-medium text-[#3D5166]">
                <CheckCircle2 className="h-5 w-5 text-[#0ABFBC]" />
                {module}
              </div>
            ))}
          </div>
          <a
            href="/login"
            className="mt-9 inline-flex h-12 w-fit items-center justify-center gap-2 rounded-sm bg-[#0ABFBC] px-7 text-sm font-bold uppercase tracking-wide text-white transition hover:-translate-y-1 hover:bg-[#0891A2]"
          >
            Ouvrir Pointage
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="relative min-h-[520px] overflow-hidden bg-[#0D1B2A]" data-reveal>
          <Image
            src="/images/landing-hero-pointage360.png"
            alt="Application Pointage pour les collaborateurs Futura"
            fill
            className="object-cover object-left-top"
            sizes="(min-width: 1024px) 54vw, 100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(13,27,42,0.55),transparent_55%)]" />
          <div className="absolute bottom-5 left-5 right-5 rounded-lg bg-white/[0.94] p-5 text-[#0D1B2A] shadow-card backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Pointage360Logo tone="dark" />
              <div className="flex items-center gap-2 text-sm font-bold text-[#0891A2]">
                <ShieldCheck className="h-4 w-4" />
                Acces securise
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {["Projet", "Chantier", "Tache"].map((item) => (
                <div key={item} className="rounded border border-[#0ABFBC]/20 bg-[#F2F7FA] px-3 py-2 text-sm font-bold">
                  Liste {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-24 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div data-reveal>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#0ABFBC]">Pourquoi nous choisir</div>
            <h2 className="landing-serif mt-3 text-4xl font-light leading-tight text-[#0D1B2A] sm:text-5xl">
              Notre <strong className="font-semibold">engagement</strong> envers vous
            </h2>
          </div>
          <div className="mt-14 grid gap-6 text-left md:grid-cols-3" data-reveal>
            {[
              {
                num: "25+",
                title: "Annees d'experience",
                description: "Un capital de savoir-faire accumule sur le terrain de l'ingenierie electrique marocaine.",
              },
              {
                num: "360",
                title: "Approche globale",
                description: "De l'etude technique a l'accompagnement managerial, avec une offre complete et coherente.",
              },
              {
                num: "INF",
                title: "Performance durable",
                description: "Des systemes de pilotage faits pour tenir dans la duree, pas seulement des rapports.",
              },
            ].map((item) => (
              <article key={item.title} className="border-t-4 border-[#E0F7F8] p-7 transition hover:border-[#0ABFBC]">
                <div className="landing-serif text-7xl font-light leading-none text-[#0ABFBC]/[0.18]">{item.num}</div>
                <h3 className="mt-5 text-lg font-bold text-[#0D1B2A]">{item.title}</h3>
                <p className="mt-3 text-sm font-light leading-7 text-[#3D5166]">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="bg-[linear-gradient(135deg,#0ABFBC_0%,#0891A2_58%,#065A82_100%)] px-4 py-24 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div data-reveal>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Parlons de votre projet</div>
            <h2 className="landing-serif mt-3 text-4xl font-light leading-tight text-white sm:text-5xl">
              Prenons <strong className="font-semibold">contact</strong>
            </h2>
            <p className="mt-5 max-w-2xl text-base font-light leading-8 text-white/[0.78]">
              Vous avez un projet d'ingenierie, une problematique de performance, ou un besoin de formation ? Futura Expertise vous accompagne.
            </p>
            <div className="mt-9 space-y-4">
              {contactItems.map((item) => {
                const Icon = item.icon;
                const content = (
                  <div className="flex items-center gap-4 text-white/[0.88]">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.15]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-white/[0.65]">{item.label}</div>
                      <div className="mt-1 text-sm font-semibold">{item.value}</div>
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

          <div className="rounded-xl bg-white p-7 text-[#0D1B2A] shadow-[0_30px_80px_rgba(0,0,0,0.2)]" data-reveal data-delay="1">
            <div className="text-lg font-bold">Acces rapide</div>
            <p className="mt-2 text-sm leading-6 text-[#3D5166]">
              Les visiteurs contactent Futura Expertise. Les collaborateurs accedent directement a l'application Pointage.
            </p>
            <div className="mt-6 grid gap-3">
              <a
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded bg-[#0ABFBC] px-5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#0891A2]"
              >
                Espace collaborateurs
                <LogIn className="h-4 w-4" />
              </a>
              <a
                href="mailto:contact@futura-expert.com"
                className="inline-flex h-12 items-center justify-center gap-2 rounded border border-[#0ABFBC]/25 px-5 text-sm font-bold uppercase tracking-wide text-[#0D1B2A] transition hover:bg-[#E0F7F8]"
              >
                Ecrire a Futura
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#080F18] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <FuturaLogo light />
          <div className="text-sm text-white/[0.35]">
            &copy; {year} Futura Expertise - Ingenierie, formation, accompagnement et Pointage collaborateurs.
          </div>
        </div>
      </footer>
    </main>
  );
}
