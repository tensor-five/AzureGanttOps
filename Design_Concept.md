# TensorFive Design System
## Complete Design Guideline for Claude Code Frontend Development

Diese Guideline dokumentiert das vollständige Design-System der TensorFive-Webseite. Sie dient als Referenz, um diesen exakten Stil in anderen Projekten zu reproduzieren.

---

## Design-Philosophie

### Aesthetic Direction: "Tech-Editorial Meets German Precision"

Das Design vereint:
- **Confidence ohne Arroganz**: Selbstbewusste, klare Aussagen
- **Seriösität mit Modernität**: Enterprise-tauglich, aber nicht langweilig
- **Strategische Asymmetrie**: Layered Depth statt flachem Minimalismus
- **Textured Depth**: Noise-Overlays, Background-Shapes, Parallax

---

## KRITISCH: "AI-Slop" Design vermeiden

> **Das wichtigste Prinzip dieses Design-Systems: Die Webseite darf NIEMALS so aussehen, als wäre sie von einer KI generiert worden.**

### Typische AI-generierte Design-Fehler (ALLE VERBOTEN):

#### 1. Gradient-Buttons
```css
/* FALSCH - Niemals verwenden */
.btn {
  background: linear-gradient(135deg, #842CC3, #a855f7);
  background: linear-gradient(to right, #842CC3, #87F3A4);
}

/* RICHTIG - Solide Farben */
.btn--primary {
  background: #842CC3;  /* Flat, solid color */
}
```

#### 2. Border-Left/Border-Top Hover-Akzente
```css
/* FALSCH - Typisches AI-Pattern */
.card:hover {
  border-left: 4px solid #842CC3;
  border-top: 3px solid #842CC3;
}

.nav__link--active {
  border-left: 3px solid var(--color-primary);
}

.sidebar-item:hover {
  border-left: 4px solid accent-color;
}

/* RICHTIG - Gleichmäßige Border-Änderung */
.card:hover {
  border-color: var(--color-primary);  /* Alle 4 Seiten gleichmäßig */
}
```

#### 3. Übertriebene Glow-Effekte
```css
/* FALSCH - Zu aggressiv */
.card:hover {
  box-shadow: 0 0 30px rgba(132, 44, 195, 0.8);
}

/* RICHTIG - Subtil und professionell */
.card:hover {
  box-shadow: 0 20px 40px -12px rgba(132, 44, 195, 0.15);
}
```

#### 4. Rainbow/Multi-Color Gradients
```css
/* FALSCH */
background: linear-gradient(90deg, #ff0080, #7928ca, #0070f3);

/* RICHTIG - Maximal 2 Farben, und nur für dekorative Akzente */
/* Primär: Solide Farben verwenden */
```

#### 5. "Floating" Decorative Elements ohne Funktion
- Zufällige Kreise/Blobs im Hintergrund
- Überflüssige geometrische Formen ohne Zweck
- Animierte Partikel ohne Kontext

### Das Prinzip: Clean & Durchgehend

| Aspekt | AI-Slop | TensorFive |
|--------|---------|------------|
| Buttons | Gradient-Fills | Solid Color |
| Card Hover | Border-Left/Top Highlight | Gleichmäßige Border |
| Shadows | Aggressive Glows | Subtile, natürliche Schatten |
| Farben | Rainbow-Gradients | 2 Brand Colors, konsistent |
| Layouts | Asymmetrie ohne Grund | Strategische, begründete Asymmetrie |
| Animationen | Bounce, Wiggle, Excessive | Smooth, purposeful, subtle |
| Decorations | Zufällige Shapes | Funktionale Background-Tiefe |

### Die Goldene Regel

**Wenn ein Design-Element "fancy" aussieht, aber keinen funktionalen Zweck erfüllt → WEGLASSEN.**

Professionelles Design erkennt man nicht daran, dass es auffällig ist, sondern daran, dass es:
- Konsistent ist (gleiche Regeln überall)
- Funktional ist (jedes Element hat einen Zweck)
- Zurückhaltend ist (Akzente sind Akzente, nicht die Norm)
- Vertrauenswürdig wirkt (Enterprise-tauglich)

---

## Anti-Patterns (Zusammenfassung)

### Typografie
- **VERBOTEN**: Inter, Roboto, Arial, Open Sans, System-Fonts als Primärfont
- **VERBOTEN**: Zu viele Font-Weights auf einer Seite (max 3-4)

### Farben
- **VERBOTEN**: Steriles Weiß (#ffffff) als Seitenhintergrund
- **VERBOTEN**: Lila Gradienten (das KI-Klischee schlechthin)
- **VERBOTEN**: Gradient-Buttons
- **VERBOTEN**: Rainbow-Farbverläufe

### Borders & Hover
- **VERBOTEN**: Border-Left/Border-Top als Hover-Indikator
- **VERBOTEN**: Unterschiedliche Border-Stärken auf verschiedenen Seiten
- **VERBOTEN**: Border-Radius der sich beim Hover ändert

### Shadows
- **VERBOTEN**: Aggressive Glow-Effekte (opacity > 0.3)
- **VERBOTEN**: Farbige Shadows ohne Kontext
- **VERBOTEN**: Box-Shadow mit blur > 50px

### Animationen
- **VERBOTEN**: Bounce-Effekte
- **VERBOTEN**: Wiggle/Shake-Animationen
- **VERBOTEN**: Animationen länger als 500ms für UI-Feedback
- **VERBOTEN**: Animationen ohne Zweck

### Layout
- **VERBOTEN**: Zentrierter Text für mehr als 3 Zeilen
- **VERBOTEN**: Cookie-Cutter 3-Column Feature-Grids ohne Variation
- **VERBOTEN**: Floating decorative elements ohne Funktion

---

## Typografie

### Schriftart: Satoshi

```css
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');

--font-display: 'Satoshi', -apple-system, blinkmacsystemfont, sans-serif;
--font-body: 'Satoshi', -apple-system, blinkmacsystemfont, sans-serif;
```

**Warum Satoshi?**
- Charakteristisch, aber nicht aufdringlich
- Moderne geometrische Sans-Serif
- Hervorragende Lesbarkeit
- Kostenlos via Fontshare

### Font Weights

| Weight | Verwendung |
|--------|------------|
| 400 (Regular) | Body Text, Paragraphen |
| 500 (Medium) | Navigation Links, Labels |
| 700 (Bold) | Headlines H3/H4, Button Text, Card Titles |
| 900 (Black) | Headlines H1/H2, Hero Titles, Statistiken |

### Font Scale (Dramatisch)

```css
--text-xs: 0.75rem;      /* 12px - Badges, Hints */
--text-sm: 0.875rem;     /* 14px - Buttons, Small Text */
--text-base: 1rem;       /* 16px - Body Text */
--text-lg: 1.125rem;     /* 18px - Lead Paragraphs */
--text-xl: 1.25rem;      /* 20px - Card Titles */
--text-2xl: 1.5rem;      /* 24px - H3 */
--text-3xl: 2rem;        /* 32px - Section Titles */
--text-4xl: 2.5rem;      /* 40px - H2 */
--text-5xl: 3.5rem;      /* 56px - Large Headlines */
--text-6xl: 4.5rem;      /* 72px - Hero Title */
```

### Letter Spacing

```css
--tracking-tight: -0.025em;  /* Headlines, große Titel */
--tracking-wide: 0.025em;    /* Subtitles */
--tracking-wider: 0.1em;     /* Section Labels, Uppercase */
```

### Line Heights

```css
--leading-tight: 1.1;     /* Headlines */
--leading-normal: 1.5;    /* Standard */
--leading-relaxed: 1.75;  /* Body Text, Descriptions */
```

### Typography Rules

```css
h1, h2, h3, h4 {
  font-family: var(--font-display);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tight);
}

h1 { font-size: var(--text-6xl); font-weight: var(--font-black); }
h2 { font-size: var(--text-4xl); }
h3 { font-size: var(--text-2xl); }
h4 { font-size: var(--text-xl); }

p {
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
}
```

---

## Farbpalette

### Brand Colors

```css
/* Primary: Distinctive Purple */
--color-primary: #842CC3;
--color-primary-light: #a855f7;
--color-primary-dark: #5b1a8a;
--color-primary-glow: rgba(132, 44, 195, 0.4);

/* Secondary: Fresh Green */
--color-secondary: #87F3A4;
```

### Light Mode

```css
--color-bg: #fafaf9;              /* Warmes Off-White, nicht steriles Weiß */
--color-bg-subtle: #f5f5f4;       /* Section Backgrounds */
--color-bg-muted: #e7e5e4;        /* Hover States */
--color-surface: #fff;            /* Cards, Dropdowns */
--color-text: #1c1917;            /* Haupttext */
--color-text-secondary: #57534e;  /* Paragraphen */
--color-text-muted: #a8a29e;      /* Hints, Placeholders */
--color-border: #d6d3d1;          /* Standard Borders */
--color-border-subtle: #e7e5e4;   /* Subtle Separators */
```

### Dark Mode

```css
[data-theme="dark"] {
  --color-bg: #0c0a09;              /* Tiefes Schwarz */
  --color-bg-subtle: #1c1917;
  --color-bg-muted: #292524;
  --color-surface: #1c1917;
  --color-text: #fafaf9;
  --color-text-secondary: #a8a29e;
  --color-text-muted: #78716c;
  --color-border: #44403c;
  --color-border-subtle: #292524;
}
```

### Farb-Anwendung

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Page Background | #fafaf9 | #0c0a09 |
| Cards | #ffffff | #1c1917 |
| Primary Actions | #842CC3 | #842CC3 |
| Success/Secondary | #87F3A4 | #87F3A4 |
| Checkmarks | #87F3A4 auf #1c1917 | #87F3A4 auf #1c1917 |

---

## Spacing System

### Golden Ratio Inspired Scale

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

### Container Widths

```css
--container-max: 1200px;      /* Standard */
--container-narrow: 900px;    /* FAQ, Text-focused */
--container-wide: 1400px;     /* Navigation */
```

### Section Padding

```css
.section {
  padding: var(--space-24) 0;  /* 96px vertical */
}
```

---

## Border Radius

```css
--radius-md: 0.5rem;      /* 8px - Small Elements */
--radius-lg: 0.75rem;     /* 12px - Buttons, Inputs */
--radius-xl: 1rem;        /* 16px - Cards */
--radius-2xl: 1.5rem;     /* 24px - Large Cards, Hero Elements */
--radius-full: 9999px;    /* Pills, Badges */
```

---

## Shadows (Dramatisch)

```css
/* Standard Shadows */
--shadow-sm: 0 1px 2px rgba(28, 25, 23, 0.05);
--shadow-md: 0 4px 6px -1px rgba(28, 25, 23, 0.07),
             0 2px 4px -2px rgba(28, 25, 23, 0.07);
--shadow-lg: 0 10px 15px -3px rgba(28, 25, 23, 0.08),
             0 4px 6px -4px rgba(28, 25, 23, 0.08);

/* Card Shadows */
--shadow-card: 0 1px 3px rgba(28, 25, 23, 0.04),
               0 8px 24px rgba(28, 25, 23, 0.08);
--shadow-card-hover: 0 4px 6px rgba(28, 25, 23, 0.05),
                     0 16px 40px rgba(28, 25, 23, 0.12);

/* Primary Glow (für Buttons, Active States) */
box-shadow: 0 4px 14px rgba(132, 44, 195, 0.35);
box-shadow: 0 6px 20px rgba(132, 44, 195, 0.45);  /* Hover */
```

### Dark Mode Shadows

```css
[data-theme="dark"] {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.3),
                 0 8px 24px rgba(0, 0, 0, 0.4);
}
```

---

## Transitions & Animations

### Timing Functions

```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Card Hover Pattern

```css
.card {
  transition: all var(--transition-slow);
}

.card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 20px 40px -12px rgba(132, 44, 195, 0.15),
              0 0 0 1px rgba(132, 44, 195, 0.1);
  transform: translateY(-4px);  /* oder -6px für größere Cards */
}
```

### Button Hover Pattern

```css
.btn--primary:hover {
  background: var(--color-primary-light);
  box-shadow: 0 6px 20px rgba(132, 44, 195, 0.45);
  transform: translateY(-2px);
}
```

### Slide Animations

```css
@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(60px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideOutToLeft {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(-60px);
  }
}
```

### Flip Card Animation

```css
.flip-card__inner {
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.flip-card:hover .flip-card__inner {
  transform: rotateY(180deg);
}
```

### Progress Bar Animation

```css
@keyframes tabProgress {
  from { width: 0; }
  to { width: 100%; }
}

.tab--active::after {
  animation: tabProgress 7s linear forwards;
}
```

### Pulse Animation

```css
@keyframes pulseArrow {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 8px 24px -8px var(--color-primary-glow);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 12px 32px -8px var(--color-primary-glow);
  }
}
```

---

## Background & Texture

### Noise Texture Overlay

```css
body::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.02;  /* Sehr subtil */
  pointer-events: none;
  z-index: 9999;
}
```

### Geometric Background Shapes

Große, überlappende Rechtecke mit leichter Rotation für Tiefe:

```css
.bg-shapes {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: visible;
}

.bg-shapes__shape {
  position: absolute;
  background: rgba(132, 44, 195, 0.045);
  border-radius: 24px;
}

/* Beispiel für ein Shape */
.bg-shapes__shape--1 {
  width: 450px;
  height: 380px;
  top: 80px;
  left: -80px;
  transform: rotate(-3deg);
  background: rgba(132, 44, 195, 0.05);
}

/* Grau-Shapes für Variation */
.bg-shapes__shape--gray {
  background: rgba(120, 113, 108, 0.045);
}

/* Dark Mode: etwas sichtbarer */
[data-theme="dark"] .bg-shapes__shape {
  background: rgba(132, 44, 195, 0.08);
}
```

### Parallax für Background Shapes

```javascript
// Unterschiedliche Geschwindigkeiten für Tiefe
const speeds = [0.08, 0.12, 0.1, 0.15, 0.09, 0.14, 0.11, 0.13];

function updateParallax() {
  const scrollY = window.pageYOffset;
  shapes.forEach((shape, index) => {
    const speed = speeds[index % speeds.length];
    const yOffset = scrollY * speed;
    shape.style.transform += ` translateY(${yOffset}px)`;
  });
}

// Nur auf Desktop (>768px) aktivieren
if (window.innerWidth > 768) {
  window.addEventListener('scroll', onScroll, { passive: true });
}
```

---

## Component Patterns

### Navigation

```css
.nav {
  position: fixed;
  height: 5rem;
  background: rgba(250, 250, 249, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--color-border-subtle);
  z-index: 300;
}

[data-theme="dark"] .nav {
  background: rgba(12, 10, 9, 0.85);
}

.nav.scrolled {
  box-shadow: var(--shadow-lg);
}
```

### Section Labels

```css
.section-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  letter-spacing: var(--tracking-wider);  /* 0.1em */
  text-transform: uppercase;
  color: var(--color-primary);
  margin-bottom: var(--space-4);
}

.section-label::before,
.section-label::after {
  content: '';
  width: 24px;
  height: 1px;
  background: var(--color-primary);
  opacity: 0.3;
}
```

### Cards

```css
.card {
  position: relative;
  padding: var(--space-10);  /* 40px */
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);  /* 24px */
  transition: all var(--transition-slow);
}

.card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 20px 40px -12px rgba(132, 44, 195, 0.15),
              0 0 0 1px rgba(132, 44, 195, 0.1);
  transform: translateY(-4px);
}
```

### Card Icons

```css
.card__icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg,
    rgba(132, 44, 195, 0.1) 0%,
    rgba(132, 44, 195, 0.05) 100%);
  border-radius: var(--radius-xl);
  margin-bottom: var(--space-6);
  color: var(--color-primary);
}
```

### Primary Button

```css
.btn--primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  color: white;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-xl);
  box-shadow: 0 4px 14px rgba(132, 44, 195, 0.35);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn--primary:hover {
  background: var(--color-primary-light);
  box-shadow: 0 6px 20px rgba(132, 44, 195, 0.45);
  transform: translateY(-2px);
}

/* Large Variant */
.btn--lg {
  padding: var(--space-4) var(--space-10);
  font-size: var(--text-base);
  border-radius: var(--radius-2xl);
}
```

### Secondary Button

```css
.btn--secondary {
  color: var(--color-text);
  background: var(--color-surface);
  border: 2px solid var(--color-border);
}

.btn--secondary:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
```

### Badge/Tag

```css
.badge {
  display: inline-block;
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: var(--color-primary);
  background: rgba(132, 44, 195, 0.1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
}
```

### Trust Badge Large

```css
.trust-badge {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: var(--space-6) var(--space-8);
  min-width: 240px;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.trust-badge:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 32px -8px rgba(132, 44, 195, 0.15),
              0 0 0 1px rgba(132, 44, 195, 0.1);
  border-color: var(--color-primary);
}

.trust-badge__icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg,
    rgba(132, 44, 195, 0.1),
    rgba(132, 44, 195, 0.05));
  border-radius: 16px;
  color: var(--color-primary);
}
```

### FAQ Accordion

```css
.faq-item {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: all var(--transition-base);
}

.faq-item[open] {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.faq-item__question {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6) var(--space-8);
  cursor: pointer;
  font-weight: var(--font-bold);
  font-size: var(--text-lg);
  list-style: none;
}

.faq-item__icon {
  transition: transform var(--transition-base);
}

.faq-item[open] .faq-item__icon {
  transform: rotate(180deg);
  color: var(--color-primary);
}
```

### Transform Cards (Before/After)

```css
.transform-card {
  flex: 1;
  padding: var(--space-6);
  border-radius: 16px;
  position: relative;
  overflow: hidden;
}

.transform-card--before {
  background: linear-gradient(135deg,
    rgba(168, 162, 158, 0.05) 0%,
    rgba(168, 162, 158, 0.02) 100%);
  border: 1px solid var(--color-border);
}

.transform-card--after {
  background: linear-gradient(135deg,
    rgba(132, 44, 195, 0.08) 0%,
    rgba(135, 243, 164, 0.05) 100%);
  border: 2px solid var(--color-primary);
  box-shadow: 0 8px 32px -8px var(--color-primary-glow);
}

/* Top accent line */
.transform-card--after::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
}

/* Checkmarks für "After" Liste */
.transform-card--after li::before {
  content: '✓';
  width: 20px;
  height: 20px;
  background: var(--color-secondary);
  color: #1c1917;
  border-radius: 50%;
  font-size: 11px;
  font-weight: var(--font-bold);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## Responsive Breakpoints

```css
/* Desktop First Approach */
@media (width <= 1024px) { /* Tablet */ }
@media (width <= 768px) { /* Mobile Landscape */ }
@media (width <= 640px) { /* Mobile */ }
@media (width <= 480px) { /* Small Mobile */ }
```

### Grid Adjustments

```css
/* 4 Columns → 2 Columns → 1 Column */
.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
}

@media (width <= 1024px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
}

@media (width <= 640px) {
  .grid-4 { grid-template-columns: 1fr; }
}
```

---

## Theme Toggle System

### HTML Setup

```html
<html lang="de" data-theme="system">
```

### Prevent Flash Script (in <head>)

```html
<script>
  (function() {
    let theme = localStorage.getItem('tensorfive-theme');
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

### Toggle Logic

```javascript
const THEME_KEY = 'tensorfive-theme';

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(THEME_KEY, newTheme);
}
```

### Icon Switching

```css
.theme-icon--light { display: none; }
.theme-icon--dark { display: block; }

[data-theme="dark"] .theme-icon--light { display: block; }
[data-theme="dark"] .theme-icon--dark { display: none; }
```

### Logo Switching

```css
.logo-light { display: block; }
.logo-dark { display: none; }

[data-theme="dark"] .logo-light { display: none; }
[data-theme="dark"] .logo-dark { display: block; }
```

---

## Icon Style

Alle Icons folgen diesem Stil:
- **Stroke-based**: Keine gefüllten Icons
- **Stroke Width**: 1.5 oder 2
- **Größen**: 20px (small), 24px (standard), 28-32px (large), 48px (hero)
- **Linecap/Linejoin**: round

```html
<svg width="24" height="24" viewBox="0 0 24 24"
     fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- icon path -->
</svg>
```

---

## CTA Section Pattern

```css
.cta {
  position: relative;
  background: var(--color-primary);
  overflow: hidden;
}

.cta__title {
  font-size: var(--text-5xl);
  font-weight: var(--font-black);
  color: white;
}

.cta__description {
  font-size: var(--text-xl);
  color: rgba(255, 255, 255, 0.85);
}

/* Inverted Buttons on Primary Background */
.cta .btn--primary {
  background: white;
  color: var(--color-primary);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.cta .btn--secondary {
  background: transparent;
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.cta .btn--secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.6);
}
```

---

## Footer Pattern

```css
.footer {
  background: var(--color-bg);
  border-top: 1px solid var(--color-border);
}

.footer__main {
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: var(--space-16);
  padding: var(--space-20) 0;
}

.footer__column-title {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  margin-bottom: var(--space-5);
}

.footer__link {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}

.footer__link:hover {
  color: var(--color-primary);
}
```

---

## Special Effects

### Glassmorphism für Navigation

```css
background: rgba(250, 250, 249, 0.8);
backdrop-filter: blur(20px) saturate(180%);
```

### Glow Effect

```css
box-shadow: 0 0 0 1px rgba(132, 44, 195, 0.1),
            0 20px 40px -12px rgba(132, 44, 195, 0.15);
```

### Gradient Accent Line

```css
&::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
}
```

---

## Complete CSS Variables Template

```css
:root {
  /* Brand Colors */
  --color-primary: #842CC3;
  --color-primary-light: #a855f7;
  --color-primary-dark: #5b1a8a;
  --color-primary-glow: rgba(132, 44, 195, 0.4);
  --color-secondary: #87F3A4;

  /* Light Mode */
  --color-bg: #fafaf9;
  --color-bg-subtle: #f5f5f4;
  --color-bg-muted: #e7e5e4;
  --color-surface: #fff;
  --color-text: #1c1917;
  --color-text-secondary: #57534e;
  --color-text-muted: #a8a29e;
  --color-border: #d6d3d1;
  --color-border-subtle: #e7e5e4;

  /* Typography */
  --font-display: 'Satoshi', -apple-system, blinkmacsystemfont, sans-serif;
  --font-body: 'Satoshi', -apple-system, blinkmacsystemfont, sans-serif;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 2rem;
  --text-4xl: 2.5rem;
  --text-5xl: 3.5rem;
  --text-6xl: 4.5rem;

  --font-normal: 400;
  --font-medium: 500;
  --font-bold: 700;
  --font-black: 900;

  --leading-tight: 1.1;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  --tracking-tight: -0.025em;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.1em;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;
  --space-24: 6rem;

  /* Border Radius */
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(28, 25, 23, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(28, 25, 23, 0.07), 0 2px 4px -2px rgba(28, 25, 23, 0.07);
  --shadow-lg: 0 10px 15px -3px rgba(28, 25, 23, 0.08), 0 4px 6px -4px rgba(28, 25, 23, 0.08);
  --shadow-card: 0 1px 3px rgba(28, 25, 23, 0.04), 0 8px 24px rgba(28, 25, 23, 0.08);
  --shadow-card-hover: 0 4px 6px rgba(28, 25, 23, 0.05), 0 16px 40px rgba(28, 25, 23, 0.12);

  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Layout */
  --container-max: 1200px;
  --container-narrow: 900px;
  --container-wide: 1400px;
  --nav-height: 5rem;

  /* Z-Index */
  --z-fixed: 300;
}
```

---

## Checkliste für neue Projekte

### Setup
- [ ] Satoshi Font von Fontshare einbinden
- [ ] CSS Variables kopieren
- [ ] Noise Texture Overlay hinzufügen
- [ ] Background Shapes für Tiefe (optional)
- [ ] Theme Toggle System implementieren

### Design-Prinzipien
- [ ] Warmes Off-White (#fafaf9) statt reines Weiß (#ffffff)
- [ ] Stroke-based Icons verwenden (keine filled)
- [ ] Dramatische Font-Skala mit tight tracking für Headlines
- [ ] Section Labels mit ::before/::after Linien

### Interaktionen
- [ ] Card Hover: Primary Border (alle 4 Seiten) + Subtle Shadow + TranslateY
- [ ] Button Hover: Solid Color Change (KEINE Gradients)
- [ ] Parallax auf Desktop aktivieren (optional)

### AI-Slop Vermeidungs-Check (KRITISCH)
- [ ] **Keine Gradient-Buttons** → Solid Colors only
- [ ] **Keine Border-Left/Top Hover-Effekte** → Gleichmäßige Borders
- [ ] **Keine übertriebenen Glows** → Opacity max 0.2-0.3
- [ ] **Keine Rainbow-Gradients** → Max 2 Brand Colors
- [ ] **Keine Bounce/Wiggle-Animationen** → Smooth & subtle
- [ ] **Keine decorativen Elemente ohne Funktion**
- [ ] **Konsistenz prüfen** → Gleiche Regeln überall angewandt?

### Finale Prüfung
- [ ] Sieht die Seite aus wie von einem Menschen designed?
- [ ] Könnte die Seite von einer seriösen Design-Agentur stammen?
- [ ] Wirkt das Design Enterprise-tauglich?
- [ ] Sind alle Hover-States konsistent (keine Border-Left anywhere)?

---

## Quick Reference: Erlaubt vs. Verboten

| Element | ERLAUBT | VERBOTEN |
|---------|---------|----------|
| Button Background | `background: #842CC3;` | `background: linear-gradient(...);` |
| Card Hover Border | `border-color: var(--primary);` | `border-left: 4px solid ...;` |
| Shadow Opacity | `rgba(color, 0.15)` | `rgba(color, 0.8)` |
| Animations | `translateY`, `opacity`, `scale` | `bounce`, `wiggle`, `shake` |
| Background | Solid + Noise Texture | Random floating shapes |
| Font | Satoshi | Inter, Roboto, Arial |

---

*Erstellt: Januar 2026*
*Design System Version: 2.1*
*TensorFive GmbH*

> "Das beste Design ist das, das man nicht bemerkt." – Dieter Rams
