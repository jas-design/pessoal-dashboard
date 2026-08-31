---
name: Obsidian Flux
colors:
  surface: '#13121a'
  surface-dim: '#13121a'
  surface-bright: '#393841'
  surface-container-lowest: '#0e0d15'
  surface-container-low: '#1c1b23'
  surface-container: '#201f27'
  surface-container-high: '#2a2932'
  surface-container-highest: '#35343d'
  on-surface: '#e5e1ec'
  on-surface-variant: '#c8c4d6'
  inverse-surface: '#e5e1ec'
  inverse-on-surface: '#312f38'
  outline: '#928fa0'
  outline-variant: '#474554'
  surface-tint: '#c5c0ff'
  primary: '#c5c0ff'
  on-primary: '#2500a1'
  primary-container: '#8a80ff'
  on-primary-container: '#20008f'
  inverse-primary: '#5648d1'
  secondary: '#c3c7cc'
  on-secondary: '#2d3135'
  secondary-container: '#43474c'
  on-secondary-container: '#b2b5bb'
  tertiary: '#ffb876'
  on-tertiary: '#4b2800'
  tertiary-container: '#d07d1f'
  on-tertiary-container: '#422200'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e4dfff'
  primary-fixed-dim: '#c5c0ff'
  on-primary-fixed: '#140067'
  on-primary-fixed-variant: '#3d2bb9'
  secondary-fixed: '#dfe3e8'
  secondary-fixed-dim: '#c3c7cc'
  on-secondary-fixed: '#181c20'
  on-secondary-fixed-variant: '#43474c'
  tertiary-fixed: '#ffdcc0'
  tertiary-fixed-dim: '#ffb876'
  on-tertiary-fixed: '#2d1600'
  on-tertiary-fixed-variant: '#6b3b00'
  background: '#13121a'
  on-background: '#e5e1ec'
  surface-variant: '#35343d'
typography:
  headline-lg:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Public Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Public Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
  label-md:
    fontFamily: Public Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  stat-lg:
    fontFamily: Public Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-padding: 2rem
  widget-gap: 1.5rem
  section-margin: 2rem
  inner-padding: 1.25rem
  gutter: 1rem
---

## Brand & Style

The design system is engineered for high-density data environments, prioritizing legibility and visual hierarchy within a deep, immersive dark mode. The brand personality is professional, analytical, and modern, targeting power users in SaaS, fintech, and enterprise operations.

The aesthetic follows a **Corporate Modern** style with subtle **Tonal Layering**. It avoids pure blacks, opting instead for a sophisticated palette of charcoals and deep navies to reduce eye strain. The visual narrative is driven by purposeful color accents—using vibrant semantical tones to highlight performance metrics and status changes against a quiet, structured background.

## Colors

The palette is centered on a deep navy foundation. The **Main Background** is a muted charcoal-blue, while **Surface Cards** use a slightly lighter tint to create depth without relying on heavy borders. 

### Semantic Palette
- **Primary:** A vivid violet used for primary actions, active states, and focus indicators.
- **Success:** A vibrant emerald for positive growth and completed states.
- **Danger:** A high-contrast coral-red for negative trends and critical alerts.
- **Warning:** A warm amber for pending actions or cautionary data.
- **Info:** A bright cyan for neutral data highlights and secondary indicators.

Text uses a tiered grayscale: high-contrast off-white for titles, and a muted slate-gray for secondary labels and metadata to maintain a clear information hierarchy.

## Typography

This design system utilizes **Public Sans** for its exceptional clarity in data-dense interfaces. The typographic scale is optimized for legibility at small sizes, which is critical for dashboard widgets and tables.

- **Headlines:** Use a semi-bold weight (600) to stand out against dark backgrounds.
- **Stats:** Specialized `stat-lg` tokens are used for primary numeric data, featuring a bold weight to draw immediate attention.
- **Labels:** Small, medium-weight labels are used for metadata (e.g., "Last Month") and table headers, often paired with a slightly reduced opacity for secondary hierarchy.

## Layout & Spacing

The layout utilizes a **Fluid Grid** system designed to maximize screen real estate while maintaining sufficient breathing room between data clusters.

- **Desktop:** A 12-column grid with a 24px gutter. Main dashboard containers have a 32px outer margin.
- **Widget Strategy:** Components are grouped into logical cards. Internal padding within cards is strictly 20px (1.25rem) to ensure data density doesn't feel cluttered.
- **Responsive Reflow:** On Tablet, the 4-column stat row collapses into a 2x2 grid. On Mobile, all elements stack vertically with a reduced outer margin of 16px.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** rather than traditional shadows.
- **Level 0 (Background):** The darkest surface (`#161D31`), used for the canvas.
- **Level 1 (Sidebar):** A high-depth surface (`#101636`) that sits "behind" or flush with the main canvas.
- **Level 2 (Cards/Widgets):** Elevated surfaces (`#283046`) that hold the primary content.
- **Interactions:** Subtle, low-opacity primary-colored glows are used for active states or hover effects on cards, replacing heavy drop shadows to keep the UI feeling "lean."

## Shapes

The shape language is **Soft** and systematic. 
- **Standard Cards:** Use a 6px to 8px radius to balance professional structure with a modern feel.
- **Interactive Elements:** Buttons and input fields follow the 6px standard.
- **Badges/Chips:** Use a fully rounded (pill-shaped) radius to distinguish them from structural elements like cards and buttons.

## Components

### Buttons & Inputs
Buttons utilize solid fills for primary actions and ghost styles (outline only) for secondary actions. Input fields use a dark-filled style (`#283046`) with a subtle 1px border that brightens on focus.

### Data Chips
Semantic status chips (Success, Danger, etc.) use a 15% opacity background of their respective color with a 100% opacity text label. This ensures the color is present but does not overwhelm the dark UI.

### Tables
Table rows use a "Zebra" striping or a subtle bottom-border (`#3B4253`). Headers are capitalized with increased letter spacing for distinction.

### Progress Bars
Used within tables and widgets, progress bars feature a subtle 4px height with a high-contrast fill and a low-opacity track.

### Sidebar Navigation
The active state is indicated by a vertical "pill" highlight and a shift in icon color to the primary violet, ensuring clear "you are here" wayfinding.