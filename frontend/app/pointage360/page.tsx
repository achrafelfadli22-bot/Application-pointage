import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileSpreadsheet,
  MapPinned,
  ShieldCheck,
  Smartphone,
  UsersRound,
} from 'lucide-react';
import { Pointage360Logo } from '@/components/landing/pointage360-logo';

export const metadata: Metadata = {
  title: 'Pointage360 - SaaS pointage GPS, feuilles de temps et RH terrain',
  description:
    'Pointage360 centralise le pointage GPS, les feuilles de temps, les conges, le planning, les sites et les rapports RH/paie.',
};

const modules = [
  {
    icon: MapPinned,
    title: 'Pointage GPS',
    text: 'Check-in et check-out mobiles avec perimetre site, statut journalier et suivi des anomalies.',
    benefit: 'Controle terrain fiable',
  },
  {
    icon: FileSpreadsheet,
    title: 'Feuilles de temps',
    text: 'Saisie des heures par projet, site et type de tache, avec soumission et validation.',
    benefit: 'Heures structurees',
  },
  {
    icon: CalendarDays,
    title: 'Planning equipe',
    text: 'Vision des presences, absences, week-ends, jours feries et retards sur une grille claire.',
    benefit: 'Organisation visible',
  },
  {
    icon: ClipboardCheck,
    title: 'Conges',
    text: 'Demandes, soldes, statuts et validations RH regroupes dans un seul flux.',
    benefit: 'Suivi RH simplifie',
  },
  {
    icon: Building2,
    title: 'Sites & projets',
    text: 'Affectations, equipes, activite et reporting par site pour piloter les operations terrain.',
    benefit: 'Pilotage par site',
  },
  {
    icon: BarChart3,
    title: 'Rapports & paie',
    text: 'Exports Excel, heures par site, anomalies GPS et donnees pretes pour la paie.',
    benefit: 'Decision rapide',
  },
];

const profiles = [
  {
    icon: Smartphone,
    title: 'Employes terrain',
    text: 'Ils pointent, consultent leur statut et soumettent leurs feuilles de temps depuis mobile.',
  },
  {
    icon: UsersRound,
    title: 'Managers',
    text: 'Ils suivent les equipes, valident les pointages et detectent les retards au bon moment.',
  },
  {
    icon: BriefcaseBusiness,
    title: 'RH',
    text: 'Ils centralisent conges, historiques, validations et exports sans ressaisie manuelle.',
  },
  {
    icon: ShieldCheck,
    title: 'Direction',
    text: 'Elle dispose d indicateurs fiables sur les presences, les sites et les couts operationnels.',
  },
];

const painPoints = [
  'Pointages terrain difficiles a controler',
  'Validations manuelles lentes et dispersees',
  'Exports RH et paie reconstruits a la main',
];

const outcomes = [
  'Presence terrain visible en temps reel',
  'Workflow N+1 / N+2 clair et tracable',
  'Rapports exploitables pour RH, paie et direction',
];

function PrimaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-white shadow-card transition hover:bg-accentHover"
    >
      {children}
    </Link>
  );
}

function SecondaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-borderSoft bg-white px-5 text-sm font-semibold text-navy shadow-card transition hover:border-accent hover:text-accentText"
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accentText">{children}</p>;
}

function ProductImage({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-borderSoft bg-surface shadow-card">
      <Image
        src={src}
        alt={alt}
        width={1680}
        height={945}
        priority={priority}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export default function Pointage360LandingPage() {
  return (
    <main className="min-h-screen bg-pageBg text-bodyText">
      <header className="sticky top-0 z-30 border-b border-borderSoft bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/pointage360" aria-label="Pointage360">
            <Pointage360Logo tone="dark" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-mutedText md:flex">
            <a href="#modules" className="hover:text-navy">Modules</a>
            <a href="#terrain" className="hover:text-navy">Terrain</a>
            <a href="#validations" className="hover:text-navy">Validations</a>
            <a href="#rapports" className="hover:text-navy">Rapports</a>
          </nav>
          <div className="flex items-center gap-2">
            <SecondaryCta href="/login">Se connecter</SecondaryCta>
            <Link
              href="mailto:contact@futura-expert.com?subject=Demande%20de%20demo%20Pointage360"
              className="hidden h-11 items-center justify-center gap-2 rounded-md bg-navy px-5 text-sm font-semibold text-white shadow-card transition hover:bg-navyLight sm:inline-flex"
            >
              Demander une demo
            </Link>
          </div>
        </div>
      </header>

      <section className="bg-white">
        <div className="mx-auto grid min-h-[calc(100vh-64px)] max-w-7xl content-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.25fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <SectionLabel>SaaS RH terrain</SectionLabel>
            <h1 className="mt-4 text-5xl font-semibold tracking-normal text-navy sm:text-6xl lg:text-7xl">
              Pointage360
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-mutedText">
              La plateforme SaaS pour piloter le pointage, les equipes terrain, les feuilles de temps et les validations RH.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryCta href="mailto:contact@futura-expert.com?subject=Demande%20de%20demo%20Pointage360">
                Demander une demo <ArrowRight className="h-4 w-4" />
              </PrimaryCta>
              <SecondaryCta href="/login">
                Se connecter
              </SecondaryCta>
            </div>
            <div className="mt-10 grid gap-3 text-sm text-mutedText sm:grid-cols-3">
              {['Pointage GPS', 'Validation N+1/N+2', 'Exports RH & paie'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <ProductImage
              src="/images/pointage360/pointage360-hero-product.png"
              alt="Mockup Pointage360 sur ordinateur et mobile"
              priority
            />
          </div>
        </div>
      </section>

      <section className="border-y border-borderSoft bg-offWhite px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <SectionLabel>Pourquoi Pointage360</SectionLabel>
            <h2 className="mt-3 text-3xl font-semibold text-navy sm:text-4xl">
              Centraliser les flux terrain avant qu ils ne deviennent des erreurs RH.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-borderSoft bg-white p-5 shadow-card">
              <p className="text-sm font-semibold text-dangerText">Avant</p>
              <div className="mt-4 grid gap-3">
                {painPoints.map((item) => (
                  <div key={item} className="flex gap-3 text-sm text-mutedText">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-dangerBorder" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-borderSoft bg-white p-5 shadow-card">
              <p className="text-sm font-semibold text-successText">Avec Pointage360</p>
              <div className="mt-4 grid gap-3">
                {outcomes.map((item) => (
                  <div key={item} className="flex gap-3 text-sm text-mutedText">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="modules" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <SectionLabel>Modules produit</SectionLabel>
            <h2 className="mt-3 text-3xl font-semibold text-navy sm:text-4xl">
              Tout le cycle temps, site et validation dans une seule plateforme.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <article key={module.title} className="rounded-lg border border-borderSoft bg-surface p-5 shadow-card">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-navyBg text-accentText">
                  <module.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-navy">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-mutedText">{module.text}</p>
                <p className="mt-4 text-sm font-semibold text-accentText">{module.benefit}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="terrain" className="border-y border-borderSoft bg-pageBg px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionLabel>Pointage GPS</SectionLabel>
            <h2 className="mt-3 text-3xl font-semibold text-navy sm:text-4xl">
              Un pointage mobile adapte aux equipes terrain.
            </h2>
            <p className="mt-5 text-base leading-7 text-mutedText">
              Les collaborateurs pointent depuis leur telephone, dans le perimetre du site, avec un statut journalier clair pour eux et pour leurs managers.
            </p>
            <div className="mt-7 grid gap-3">
              {['Check-in et check-out mobile', 'Perimetre GPS par site', 'Retards, absences et anomalies visibles'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-bodyText">
                  <Clock3 className="h-4 w-4 text-accent" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <ProductImage src="/images/pointage360/pointage360-gps-field.png" alt="Pointage GPS sur site" />
        </div>
      </section>

      <section id="validations" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <ProductImage src="/images/pointage360/pointage360-manager-dashboard.png" alt="Tableau de bord manager Pointage360" />
          <div>
            <SectionLabel>Managers et validations</SectionLabel>
            <h2 className="mt-3 text-3xl font-semibold text-navy sm:text-4xl">
              Decider vite avec une vue claire des presences et des approbations.
            </h2>
            <p className="mt-5 text-base leading-7 text-mutedText">
              Les managers suivent les presents, absents, retards et demandes en attente, puis valident selon un workflow N+1 / N+2 tracable.
            </p>
            <div className="mt-7 grid gap-3">
              {['Pointages a valider', 'Pre-approbation N+1', 'Historique et notifications'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-bodyText">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-borderSoft bg-pageBg px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionLabel>Feuilles de temps</SectionLabel>
            <h2 className="mt-3 text-3xl font-semibold text-navy sm:text-4xl">
              Des heures par projet, site et jour, sans tableur disperse.
            </h2>
            <p className="mt-5 text-base leading-7 text-mutedText">
              Les feuilles de temps structurent la saisie, verrouillent les periodes standards et accelerent la validation avant reporting.
            </p>
            <div className="mt-7 grid gap-3">
              {['Saisie hebdomadaire ou mensuelle', 'Lignes par site et type de tache', 'Soumission, rejet, reouverture et validation'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-bodyText">
                  <FileSpreadsheet className="h-4 w-4 text-accent" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <ProductImage src="/images/pointage360/pointage360-timesheet-grid.png" alt="Grille de feuille de temps Pointage360" />
        </div>
      </section>

      <section id="rapports" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <ProductImage src="/images/pointage360/pointage360-reports-payroll.png" alt="Rapports et exports paie Pointage360" />
          <div>
            <SectionLabel>Rapports et paie</SectionLabel>
            <h2 className="mt-3 text-3xl font-semibold text-navy sm:text-4xl">
              Transformer les donnees terrain en exports RH exploitables.
            </h2>
            <p className="mt-5 text-base leading-7 text-mutedText">
              Pointage360 consolide les heures, les anomalies GPS, les absences et les validations pour produire des exports fiables.
            </p>
            <div className="mt-7 grid gap-3">
              {['Exports Excel', 'Heures par site et par employe', 'Anomalies GPS et donnees de paie'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-bodyText">
                  <BarChart3 className="h-4 w-4 text-accent" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-borderSoft bg-offWhite px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <SectionLabel>Profils utilisateurs</SectionLabel>
            <h2 className="mt-3 text-3xl font-semibold text-navy sm:text-4xl">
              Chaque role voit exactement ce dont il a besoin.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {profiles.map((profile) => (
              <article key={profile.title} className="rounded-lg border border-borderSoft bg-white p-5 shadow-card">
                <profile.icon className="h-6 w-6 text-accent" />
                <h3 className="mt-5 text-base font-semibold text-navy">{profile.title}</h3>
                <p className="mt-2 text-sm leading-6 text-mutedText">{profile.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-lg border border-borderSoft bg-navy p-8 text-white shadow-card lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/70">Produit edite par Futura Expertise</p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
              Developpe pour repondre aux besoins reels des entreprises terrain.
            </h2>
          </div>
          <PrimaryCta href="mailto:contact@futura-expert.com?subject=Demande%20de%20demo%20Pointage360">
            Demander une demo <ArrowRight className="h-4 w-4" />
          </PrimaryCta>
        </div>
      </section>

      <section className="bg-pageBg px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <SectionLabel>Passer a l action</SectionLabel>
          <h2 className="mt-3 text-3xl font-semibold text-navy sm:text-4xl">
            Pret a structurer votre pointage terrain ?
          </h2>
          <p className="mt-5 text-base leading-7 text-mutedText">
            Demandez une demonstration et voyez comment Pointage360 peut organiser le temps, les sites et les validations de vos equipes.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <PrimaryCta href="mailto:contact@futura-expert.com?subject=Demande%20de%20demo%20Pointage360">
              Demander une demo <ArrowRight className="h-4 w-4" />
            </PrimaryCta>
            <SecondaryCta href="/login">Acceder a la plateforme</SecondaryCta>
          </div>
        </div>
      </section>
    </main>
  );
}
