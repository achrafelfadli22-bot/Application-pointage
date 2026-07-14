"use client";

/**
 * Landing page — Futura Expertise × Pointage360
 *
 * Images Futura Expertise dans frontend/public/images/ :
 *   futura-salle-controle.jpg
 *   futura-technicien-mesure.jpg
 *   futura-haute-tension.jpg
 *   futura-formation-iec.jpg
 */

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  LogIn,
  Mail,
  MapPin,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  UsersRound,
  Workflow,
  Zap,
} from "lucide-react";
import { Pointage360Logo } from "./pointage360-logo";

// ── Brand tokens ──────────────────────────────────────────────────────────────
const TEAL    = "#0ABFBC";
const TEAL_D  = "#0891A2";
const NAVY    = "#0D1B2A";
const NAVY_2  = "#1B3A5C";

// ── Data ──────────────────────────────────────────────────────────────────────

const navLinks = [
  { href: "#expertise", label: "Expertise" },
  { href: "#terrain",   label: "Terrain" },
  { href: "#formation", label: "Formation" },
  { href: "#pointage",  label: "Pointage360" },
  { href: "#contact",   label: "Contact" },
];

const stats = [
  { value: "25+",  label: "Années d'expérience" },
  { value: "4",    label: "Pôles d'expertise" },
  { value: "100%", label: "Engagement terrain" },
  { value: "360°", label: "Vision globale" },
];

const services = [
  {
    icon: Zap,
    name: "Expertise électrique",
    color: "#0ABFBC",
    items: ["Dimensionnement HT/MT/BT", "Étude des harmoniques", "Sélectivité et protections", "Compensation réactive", "Contrôle de conformité"],
  },
  {
    icon: GraduationCap,
    name: "Formation technique",
    color: "#3B82F6",
    items: ["Normes C15-100 et C14-100", "Régimes du neutre", "Courants de court-circuit", "Protection foudre", "Habilitations électriques"],
  },
  {
    icon: ClipboardCheck,
    name: "Bureaux d'études",
    color: "#8B5CF6",
    items: ["Restructuration organisationnelle", "Process métiers", "Tableaux de bord", "Gestion des compétences", "Digitalisation documentaire"],
  },
  {
    icon: BarChart3,
    name: "Analyse stratégique",
    color: "#F59E0B",
    items: ["Diagnostic interne", "Diagnostic externe", "Analyse SWOT", "Projets structurants", "Indicateurs de performance"],
  },
  {
    icon: UsersRound,
    name: "Capital humain",
    color: "#10B981",
    items: ["Missions et responsabilités", "Ingénierie de formation", "Motivation des équipes", "Climat de travail", "Équilibre pro/personnel"],
  },
  {
    icon: Workflow,
    name: "Process & digital",
    color: "#EF4444",
    items: ["Flux d'information", "Automatisation reporting", "Pointage terrain", "Feuilles de temps projet", "Validation N+1/N+2"],
  },
];

const pointageFeatures = [
  "Pointage GPS site en temps réel",
  "Feuilles de temps hebdomadaires / mensuelles",
  "Demandes et suivi des congés",
  "Validation hiérarchique N+1 / N+2",
  "Rapports RH et analytiques avancés",
  "Tableau de bord multi-rôles",
];

const contactItems = [
  { icon: MapPin, label: "Adresse", value: "Casablanca, Maroc", href: null },
  { icon: Phone,  label: "Téléphone", value: "+212 5 22 XX XX XX", href: "tel:+212522XXXXXX" },
  { icon: Mail,   label: "Email", value: "contact@futura-expert.com", href: "mailto:contact@futura-expert.com" },
];

// ── Logo Futura ───────────────────────────────────────────────────────────────

function FuturaLogo({ light = false }: { light?: boolean }) {
  return (
    <div
      className={[
        "relative flex h-12 w-[158px] items-center",
        light ? "rounded-md bg-white/95 px-2 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.18)]" : "",
        "sm:w-[178px]",
      ].join(" ")}
      aria-label="Futura Expertise"
    >
      <Image
        src="/images/futura-expertise-logo.png"
        alt="Futura Expertise"
        width={650}
        height={371}
        className="h-full w-full object-contain"
        priority={light}
      />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  const year = new Date().getFullYear();
  const [scrolled, setScrolled] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    setIsLightMode(window.localStorage.getItem("futura.landingLighting") === "light");
  }, []);

  const toggleLightingMode = () => {
    setIsLightMode((current) => {
      const next = !current;
      window.localStorage.setItem("futura.landingLighting", next ? "light" : "dark");
      return next;
    });
  };

  const theme = {
    pageBg: isLightMode ? "#F5FAFC" : "#080F18",
    headerBg: isLightMode ? "rgba(255,255,255,0.94)" : "rgba(8,15,24,0.95)",
    headerIdleBg: isLightMode ? "rgba(255,255,255,0.78)" : "transparent",
    headerBorder: isLightMode ? "rgba(13,27,42,0.12)" : "transparent",
    headerShadow: isLightMode ? "0 10px 30px rgba(13,27,42,0.10)" : "0 2px 24px rgba(0,0,0,0.45)",
    navText: isLightMode ? "#27415A" : "rgba(255,255,255,0.75)",
    heroOverlay: isLightMode
      ? "linear-gradient(90deg, rgba(245,250,252,0.94) 0%, rgba(245,250,252,0.78) 45%, rgba(245,250,252,0.24) 100%)"
      : "linear-gradient(to top, #040A12 0%, rgba(4,10,18,0.70) 55%, rgba(4,10,18,0.20) 100%)",
    heroText: isLightMode ? NAVY : "#FFFFFF",
    heroMuted: isLightMode ? "#3D5166" : "rgba(255,255,255,0.70)",
    panelBg: isLightMode ? "#F5FAFC" : NAVY,
    panelAltBg: isLightMode ? "#EAF4F7" : NAVY_2,
    panelText: isLightMode ? NAVY : "#FFFFFF",
    panelMuted: isLightMode ? "#3D5166" : "rgba(255,255,255,0.60)",
    cardBg: isLightMode ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.04)",
    cardBorder: isLightMode ? "rgba(13,27,42,0.10)" : "rgba(255,255,255,0.08)",
    cardShadow: isLightMode ? "0 14px 40px rgba(13,27,42,0.08)" : "0 16px 48px rgba(0,0,0,0.40)",
    footerBg: isLightMode ? "#EEF6F8" : "#080F18",
    footerText: isLightMode ? "#3D5166" : "rgba(255,255,255,0.30)",
    highVoltageOverlay: isLightMode ? "rgba(245,250,252,0.76)" : "rgba(4,10,18,0.75)",
  };

  return (
    <main className="min-h-screen overflow-x-hidden font-sans antialiased" style={{ background: theme.pageBg }}>

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header
        className="fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 backdrop-blur-md"
        style={{
          background: scrolled ? theme.headerBg : theme.headerIdleBg,
          borderColor: theme.headerBorder,
          boxShadow: scrolled ? theme.headerShadow : "none",
        }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <FuturaLogo light />

          <nav className="hidden items-center gap-7 md:flex">
            {navLinks.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-sm font-medium transition hover:opacity-75"
                style={{ color: theme.navText }}
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLightingMode}
              aria-pressed={isLightMode}
              title={isLightMode ? "Passer en mode sombre" : "Passer en mode clair"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border transition hover:opacity-80"
              style={{
                background: isLightMode ? "rgba(13,27,42,0.08)" : "rgba(255,255,255,0.12)",
                borderColor: isLightMode ? "rgba(13,27,42,0.16)" : "rgba(255,255,255,0.18)",
                color: isLightMode ? NAVY : "#FFFFFF",
              }}
            >
              {isLightMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            <Link
              href="/login"
              className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-bold text-white transition hover:opacity-80"
              style={{ background: `linear-gradient(90deg, ${TEAL}, ${TEAL_D})` }}
            >
              <LogIn className="h-4 w-4" />
              Connexion
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        className="relative flex min-h-screen items-end overflow-hidden"
        style={{ backgroundImage: "url('/images/futura-salle-controle.jpg'), linear-gradient(180deg, #040A12 0%, #040A12 100%)", backgroundSize: "cover", backgroundPosition: "center" }}
      >
        {/* Dégradé sombre */}
        <div className="absolute inset-0" style={{ background: theme.heroOverlay }} />
        {/* Bandeau teal gauche */}
        <div
          className="absolute left-0 top-0 h-full w-1"
          style={{ background: `linear-gradient(180deg, transparent, ${TEAL}, transparent)` }}
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div
              className="mb-5 inline-block rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em]"
              style={{ borderColor: `${TEAL}44`, color: TEAL, background: `${TEAL}12` }}
            >
              Futura Expertise — Casablanca
            </div>
            <h1 className="text-5xl font-extrabold leading-[1.08] sm:text-6xl lg:text-7xl" style={{ color: theme.heroText }}>
              L&apos;Ingénierie{" "}
              <span style={{ color: TEAL }}>Électrique</span>{" "}
              de Précision
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-8" style={{ color: theme.heroMuted }}>
              Expertise HT/BT, formation certifiante, accompagnement managérial et digitalisation RH — tout ce qu&apos;il faut pour piloter vos installations et vos équipes.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="#contact"
                className="inline-flex h-12 items-center gap-2 rounded-md px-7 text-sm font-bold uppercase tracking-wide text-white transition hover:-translate-y-0.5"
                style={{ background: `linear-gradient(90deg, ${TEAL}, ${TEAL_D})` }}
              >
                Parlons de votre projet
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#expertise"
                className="inline-flex h-12 items-center gap-2 rounded-md border px-7 text-sm font-bold uppercase tracking-wide backdrop-blur transition hover:opacity-80"
                style={{
                  borderColor: isLightMode ? "rgba(13,27,42,0.20)" : "rgba(255,255,255,0.25)",
                  color: theme.heroText,
                  background: isLightMode ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.04)",
                }}
              >
                Nos services
              </a>
            </div>
          </div>
        </div>

        {/* Stats overlay */}
        <div
          className="absolute bottom-0 right-0 hidden items-stretch divide-x divide-white/10 overflow-hidden rounded-tl-2xl lg:flex"
          style={{
            background: isLightMode ? "rgba(255,255,255,0.88)" : `${NAVY}dd`,
            boxShadow: isLightMode ? "0 14px 40px rgba(13,27,42,0.12)" : "none",
          }}
        >
          {stats.map((s) => (
            <div key={s.label} className="px-8 py-5 text-center backdrop-blur-sm">
              <div className="text-3xl font-extrabold" style={{ color: TEAL }}>{s.value}</div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide" style={{ color: theme.panelMuted }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats mobile ────────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 divide-x divide-y divide-white/10 sm:grid-cols-4 lg:hidden"
        style={{ background: isLightMode ? "#EEF6F8" : "#080F18" }}
      >
        {stats.map((s) => (
          <div key={s.label} className="px-6 py-5 text-center">
            <div className="text-2xl font-extrabold" style={{ color: TEAL }}>{s.value}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: theme.panelMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Services ────────────────────────────────────────────────────────── */}
      <section id="expertise" className="px-4 py-24 transition-colors duration-300 sm:px-6 lg:px-8" style={{ background: theme.panelBg }}>
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: TEAL }}>
              Ce que nous faisons
            </div>
            <h2 className="mt-3 text-4xl font-extrabold sm:text-5xl" style={{ color: theme.panelText }}>
              6 pôles d&apos;expertise
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base font-light leading-7" style={{ color: theme.panelMuted }}>
              De l&apos;étude de schémas haute tension à la digitalisation RH, notre offre couvre l&apos;intégralité du cycle de performance.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((svc) => {
              const Icon = svc.icon;
              return (
                <article
                  key={svc.name}
                  className="group rounded-xl border p-6 transition-all duration-300 hover:-translate-y-1"
                  style={{ background: theme.cardBg, borderColor: theme.cardBorder, boxShadow: isLightMode ? theme.cardShadow : undefined }}
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-lg"
                    style={{ background: `${svc.color}22`, border: `1px solid ${svc.color}44` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: svc.color }} />
                  </div>
                  <h3 className="mt-4 text-base font-bold" style={{ color: theme.panelText }}>{svc.name}</h3>
                  <ul className="mt-4 space-y-2">
                    {svc.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm transition group-hover:opacity-80" style={{ color: theme.panelMuted }}>
                        <div
                          className="h-1 w-1 shrink-0 rounded-full"
                          style={{ background: svc.color }}
                        />
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

      {/* ── Terrain split ───────────────────────────────────────────────────── */}
      <section id="terrain" className="grid lg:grid-cols-2">
        {/* Image technicien sur tableau */}
        <div
          className="relative min-h-[480px] overflow-hidden"
          style={{ backgroundImage: "url('/images/futura-technicien-mesure.jpg'), linear-gradient(135deg, #0D1B2A 0%, #1B3A5C 100%)", backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30" />
        </div>

        {/* Texte */}
        <div
          className="flex flex-col justify-center px-8 py-20 lg:px-16"
          style={{ background: theme.panelAltBg }}
        >
          <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: TEAL }}>
            Expertise terrain
          </div>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl" style={{ color: theme.panelText }}>
            Au cœur des{" "}
            <span style={{ color: TEAL }}>installations</span>
          </h2>
          <p className="mt-5 text-base font-light leading-8" style={{ color: theme.panelMuted }}>
            Nos ingénieurs interviennent directement sur site pour analyser, mesurer et certifier la conformité de vos installations haute et basse tension — avec les EPI adaptés à chaque environnement.
          </p>
          <ul className="mt-7 space-y-3">
            {[
              "Mesures électriques sur site (THD, puissance, etc.)",
              "Analyse des schémas unifilaires HT/MT/BT",
              "Vérification des protections et sélectivités",
              "Rapport de conformité certifié",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm" style={{ color: theme.panelMuted }}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TEAL }} />
                {item}
              </li>
            ))}
          </ul>
          <a
            href="#contact"
            className="mt-9 inline-flex h-11 w-fit items-center gap-2 rounded-md px-6 text-sm font-bold uppercase tracking-wide text-white transition hover:opacity-85"
            style={{ background: `linear-gradient(90deg, ${TEAL}, ${TEAL_D})` }}
          >
            Demander un diagnostic
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* ── Haute tension — full bleed ───────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-32 lg:py-44"
        style={{ backgroundImage: "url('/images/futura-haute-tension.jpg'), linear-gradient(180deg, #040A12 0%, #040A12 100%)", backgroundSize: "cover", backgroundPosition: "center" }}
      >
        {/* Double overlay : sombre + teal latéral */}
        <div className="absolute inset-0" style={{ background: theme.highVoltageOverlay }} />
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ background: `linear-gradient(180deg, transparent, ${TEAL}, transparent)` }}
        />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div
            className="mx-auto mb-5 inline-block rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em]"
            style={{ borderColor: `${TEAL}44`, color: TEAL, background: `${TEAL}12` }}
          >
            Sécurité & Conformité
          </div>
          <h2 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl" style={{ color: theme.panelText }}>
            Haute tension,{" "}
            <span style={{ color: TEAL }}>zéro compromis</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-light leading-8" style={{ color: theme.panelMuted }}>
            Chaque intervention sur vos armoires HT/BT est réalisée avec le niveau d&apos;EPI et les procédures LOTO adaptés. Nos techniciens sont habilités et formés aux risques d&apos;arc flash.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-5">
            {[
              { icon: ShieldCheck, label: "Habilitations électriques certifiées" },
              { icon: ShieldCheck, label: "Procédures LOTO rigoureuses" },
              { icon: ShieldCheck, label: "EPI conforme IEC 61482" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-lg border px-5 py-3 backdrop-blur"
                style={{
                  background: isLightMode ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.05)",
                  borderColor: theme.cardBorder,
                }}
              >
                <Icon className="h-4 w-4 shrink-0" style={{ color: TEAL }} />
                <span className="text-sm font-medium" style={{ color: theme.panelText }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Formation split ──────────────────────────────────────────────────── */}
      <section id="formation" className="grid lg:grid-cols-2">
        {/* Texte */}
        <div
          className="flex flex-col justify-center px-8 py-20 lg:px-16"
          style={{ background: "#F8FAFC" }}
        >
          <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: TEAL }}>
            Formation certifiante
          </div>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight text-[#0D1B2A] sm:text-5xl">
            Maîtrisez les{" "}
            <span style={{ color: TEAL }}>normes IEC</span>
          </h2>
          <p className="mt-5 text-base font-light leading-8 text-[#3D5166]">
            Nos formations certifiantes couvrent les normes IEC 60617, C15-100, C14-100, les régimes du neutre et les habilitations électriques — animées par des ingénieurs praticiens.
          </p>
          <ul className="mt-7 space-y-3">
            {[
              "IEC 60617 — Symboles et schémas normalisés",
              "Normes C15-100 installations BT",
              "Courants de court-circuit et protections",
              "Habilitations électriques B0 → BR / BC",
              "Protection contre la foudre (NFC 17-102)",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-[#3D5166]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TEAL }} />
                {item}
              </li>
            ))}
          </ul>
          <a
            href="#contact"
            className="mt-9 inline-flex h-11 w-fit items-center gap-2 rounded-md px-6 text-sm font-bold uppercase tracking-wide text-white transition hover:opacity-85"
            style={{ background: `linear-gradient(90deg, ${TEAL}, ${TEAL_D})` }}
          >
            Catalogue de formations
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* Image formation IEC */}
        <div
          className="relative min-h-[480px] overflow-hidden"
          style={{ backgroundImage: "url('/images/futura-formation-iec.jpg'), linear-gradient(135deg, #1B3A5C 0%, #0D1B2A 100%)", backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/20" />
          {/* Badge IEC */}
          <div
            className="absolute bottom-6 right-6 rounded-xl px-5 py-4 shadow-2xl backdrop-blur-md"
            style={{ background: `${NAVY}ee` }}
          >
            <div className="text-xs font-bold uppercase tracking-wide text-white/50">Certification</div>
            <div className="mt-1 text-lg font-extrabold text-white">IEC 60617</div>
            <div className="mt-0.5 text-xs text-white/60">Normes internationales</div>
          </div>
        </div>
      </section>

      {/* ── Pointage360 ─────────────────────────────────────────────────────── */}
      <section id="pointage" className="px-4 py-24 transition-colors duration-300 sm:px-6 lg:px-8" style={{ background: theme.panelBg }}>
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            {/* Texte */}
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: TEAL }}>
                Application collaborateurs
              </div>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl" style={{ color: theme.panelText }}>
                Pointage360 —{" "}
                <span style={{ color: TEAL }}>le digital RH</span>{" "}
                de Futura
              </h2>
              <p className="mt-5 max-w-xl text-base font-light leading-8" style={{ color: theme.panelMuted }}>
                Les collaborateurs pointent sur site, soumettent leurs feuilles de temps et suivent leurs congés depuis un seul espace sécurisé, accessible depuis n&apos;importe quel appareil.
              </p>
              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {pointageFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm" style={{ color: theme.panelMuted }}>
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: TEAL }} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/login"
                className="mt-9 inline-flex h-12 items-center gap-2 rounded-md px-7 text-sm font-bold uppercase tracking-wide text-white transition hover:opacity-85"
                style={{ background: `linear-gradient(90deg, ${TEAL}, ${TEAL_D})` }}
              >
                Accéder à Pointage360
                <LogIn className="h-4 w-4" />
              </a>
            </div>

            {/* Card mockup */}
            <div
              className="rounded-2xl border p-6"
              style={{ background: theme.cardBg, borderColor: theme.cardBorder, boxShadow: isLightMode ? theme.cardShadow : undefined }}
            >
              <div className="flex items-center justify-between">
                <Pointage360Logo tone={isLightMode ? "dark" : "light"} />
                <div
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                  style={{ background: `${TEAL}22`, color: TEAL }}
                >
                  <ShieldCheck className="h-3 w-3" />
                  Sécurisé
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {["Pointage GPS", "Feuilles de temps", "Congés", "Équipe", "Rapports"].map((item) => (
                  <div
                    key={item}
                    className="rounded-lg border p-3 text-center text-xs font-semibold transition hover:opacity-80"
                    style={{ background: isLightMode ? "rgba(255,255,255,0.70)" : "rgba(255,255,255,0.04)", borderColor: theme.cardBorder, color: theme.panelMuted }}
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { label: "Rôles", value: "6" },
                  { label: "Modules", value: "9+" },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-lg p-4 text-center"
                    style={{ background: `${TEAL}15` }}
                  >
                    <div className="text-2xl font-extrabold" style={{ color: TEAL }}>{value}</div>
                    <div className="mt-0.5 text-xs" style={{ color: theme.panelMuted }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────────────────────────────── */}
      <section
        id="contact"
        className="px-4 py-24 text-white sm:px-6 lg:px-8"
        style={{ background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_D} 58%, #065A82 100%)` }}
      >
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
              Parlons de votre projet
            </div>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight text-white sm:text-5xl">
              Prenons <span className="underline decoration-white/30 underline-offset-4">contact</span>
            </h2>
            <p className="mt-5 max-w-xl text-base font-light leading-8 text-white/75">
              Ingénierie électrique, formation, accompagnement managérial ou accès à Pointage360 — notre équipe répond sous 24 h.
            </p>
            <div className="mt-9 space-y-4">
              {contactItems.map(({ icon: Icon, label, value, href }) => {
                const content = (
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-white/60">{label}</div>
                      <div className="mt-0.5 text-sm font-semibold text-white">{value}</div>
                    </div>
                  </div>
                );
                return href ? (
                  <a key={label} href={href} className="block transition hover:opacity-80">{content}</a>
                ) : (
                  <div key={label}>{content}</div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-7 text-[#0D1B2A] shadow-[0_30px_80px_rgba(0,0,0,0.25)]">
            <div className="text-lg font-extrabold">Accès rapide</div>
            <p className="mt-2 text-sm leading-6 text-[#3D5166]">
              Collaborateurs Futura : connectez-vous à Pointage360. Nouveaux clients : écrivez-nous.
            </p>
            <div className="mt-6 grid gap-3">
              <a
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-bold uppercase tracking-wide text-white transition hover:opacity-85"
                style={{ background: `linear-gradient(90deg, ${TEAL}, ${TEAL_D})` }}
              >
                Espace collaborateurs
                <LogIn className="h-4 w-4" />
              </a>
              <a
                href="mailto:contact@futura-expert.com"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border-2 text-sm font-bold uppercase tracking-wide transition hover:bg-[#F0F9FF]"
                style={{ borderColor: `${TEAL}40`, color: TEAL_D }}
              >
                Contacter Futura
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="px-4 py-10 transition-colors duration-300 sm:px-6 lg:px-8" style={{ background: theme.footerBg }}>
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <FuturaLogo light />
          <div className="text-center text-sm md:text-right" style={{ color: theme.footerText }}>
            &copy; {year} Futura Expertise · Ingénierie, Formation, Accompagnement
            <br />
            <span className="text-xs">Propulsé par </span>
            <Pointage360Logo tone={isLightMode ? "dark" : "light"} compact />
          </div>
        </div>
      </footer>
    </main>
  );
}
