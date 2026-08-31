---
name: Luminous Admin
colors:
  surface: '#fcf8ff'
  surface-dim: '#dbd8e4'
  surface-bright: '#fcf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f2fe'
  surface-container: '#efecf8'
  surface-container-high: '#e9e6f3'
  surface-container-highest: '#e4e1ed'
  on-surface: '#1b1b23'
  on-surface-variant: '#464554'
  inverse-surface: '#303038'
  inverse-on-surface: '#f2effb'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#516072'
  on-secondary: '#ffffff'
  secondary-container: '#d2e1f7'
  on-secondary-container: '#556477'
  tertiary: '#904900'
  on-tertiary: '#ffffff'
  tertiary-container: '#b55d00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#d4e4fa'
  secondary-fixed-dim: '#b9c8de'
  on-secondary-fixed: '#0d1c2d'
  on-secondary-fixed-variant: '#39485a'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb783'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703700'
  background: '#fcf8ff'
  on-background: '#1b1b23'
  surface-variant: '#e4e1ed'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 24px
  gutter: 20px
  card-padding: 24px
  stack-gap-lg: 32px
  stack-gap-md: 16px
  stack-gap-sm: 8px
---

## Brand & Style

This design system transitions the visual identity from a high-density dark interface to a refined, airy Light Mode environment. The brand personality is professional, data-centric, and exceptionally clear. By leveraging a **Corporate / Modern** style with subtle **Glassmorphic** influences, the UI maintains its sophisticated edge while significantly improving legibility and perceived cognitive load. 

The aesthetic relies on structural precision, where hierarchy is established through meticulous typography and "layered" white surfaces rather than heavy color blocks. It targets enterprise users who require long-dwell-time interfaces that feel energetic yet calm.

## Colors

The palette shifts to a "High-Definition White" foundation. 
- **Primary:** A vibrant Indigo/Purple remains the anchor, used for active states and critical calls to action.
- **Neutrals:** The background uses a cool-toned off-white (`#F8FAFC`) to differentiate from the pure white (`#FFFFFF`) cards. This creates a natural "lift" without needing heavy shadows.
- **Semantic Colors:** Emerald, Amber, and Rose tones are slightly desaturated for better harmony against light backgrounds, while maintaining high accessibility ratios for data visualization and status indicators.
- **Contrast:** Headings utilize Dark Slate to ensure maximum readability against white surfaces, while secondary text uses a softer grey to denote metadata.

## Typography

The design system utilizes **Plus Jakarta Sans** as the primary typeface for its modern, slightly rounded geometric forms that feel welcoming yet professional. 

**Inter** is utilized as a secondary font for functional labels and small data points to ensure maximum legibility at tiny scales. The scale prioritizes "Large Numbers" for metrics (Display LG/MD) to allow users to scan dashboards at a glance. We use tight letter-spacing on larger headings to maintain a compact, premium "editorial" feel.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a standard 12-column system for the main content area.
- **Margins:** A consistent 24px outer margin ensures content never feels cramped against the viewport edges.
- **Gutters:** 20px gutters provide a clear distinction between cards while maximizing the "white space" effect.
- **Rhythm:** An 8px base unit drives all spacing. Component heights and internal padding always align to multiples of 4 or 8.
- **Adaptation:** On tablet, gutters reduce to 16px. On mobile, cards stack vertically with a 16px margin and the side navigation collapses into a bottom bar or hamburger menu.

## Elevation & Depth

Hierarchy is established using **Tonal Layers** supplemented by **Low-Contrast Outlines**.
- **Level 0 (Background):** `#F8FAFC` - The canvas.
- **Level 1 (Cards/Surfaces):** Pure white with a 1px border (`#E2E8F0`). This level uses a very soft, diffused shadow (`0 4px 6px -1px rgb(0 0 0 / 0.05)`) to create separation.
- **Level 2 (Hover/Modals):** Increased shadow depth (`0 10px 15px -3px rgb(0 0 0 / 0.1)`) to indicate interactivity or focus.
- **Navigation:** The sidebar uses a high-contrast dark theme to maintain brand continuity and focus the eye on the light content area.

## Shapes

The design system adopts a **Rounded** aesthetic (0.5rem base) to soften the "industrial" feel of data-heavy dashboards. 
- Large containers (Cards, Modals) use `rounded-xl` (1.5rem/24px) for a modern, friendly appearance.
- Interactive elements like buttons and input fields use the base `rounded-md` (0.5rem/8px).
- Status badges/tags use a pill-shape (full radius) to distinguish them from interactive buttons.

## Components

- **Cards:** White background, subtle border, and 24px internal padding. Icons within cards should be housed in soft-colored circular or squircle containers (e.g., a light purple background for a primary icon).
- **Buttons:** 
  - *Primary:* Solid Indigo with white text.
  - *Secondary:* Light grey background (`#F1F5F9`) with dark slate text.
- **Input Fields:** White background with a 1px border. On focus, the border transitions to the primary Indigo color with a 2px soft outer glow.
- **Chips/Badges:** Use a "soft-filled" style—low-opacity background of the semantic color (e.g., 10% Emerald) paired with high-contrast text of the same hue.
- **Progress Bars:** Use a 6px height with a rounded track. The "track" should be a very light neutral (`#F1F5F9`) while the "fill" uses the semantic color.
- **Data Tables:** Remove vertical borders. Use horizontal dividers (`#F1F5F9`) and a subtle highlight on row hover to maintain a clean flow.