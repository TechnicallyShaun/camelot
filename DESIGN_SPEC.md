# 🎨 Camelot Design Specification

## Overview
This document outlines the design system for Camelot, a modern AI-powered development cockpit. Our design philosophy centers on the "Midnight Pragmatist" aesthetic — a sophisticated dark theme that prioritizes developer productivity through excellent contrast, clear hierarchy, and intentional interactions.

## Design Philosophy

### Core Principles
1. **Developer-First**: Optimized for long coding sessions with reduced eye strain
2. **Information Density**: Pack information efficiently without overwhelming
3. **Contextual Hierarchy**: Critical information stands out through color, typography, and spacing
4. **Subtle Sophistication**: Professional appearance without distracting flourishes
5. **Terminal Heritage**: Draws inspiration from beloved terminal environments

### Inspiration Analysis

#### Linear
- **Strengths**: Sophisticated gradient usage, excellent contrast ratios, bold typography
- **Application**: Adopt their approach to subtle gradients on interactive elements
- **Key Insight**: Limited chrome usage prevents visual noise

#### Vercel
- **Strengths**: Pure minimalism with confidence in black/white balance
- **Application**: Clean spacing patterns, high contrast for critical actions
- **Key Insight**: `oklch(0 0 0)` pure blacks and `oklch(1 0 0)` pure whites create timeless appeal

#### Raycast
- **Strengths**: React-based UI components, native feel despite web tech
- **Application**: Consistent component patterns, keyboard-first interactions
- **Key Insight**: UI component library approach allows focus on logic over pixels

#### Warp Terminal
- **Strengths**: Modern terminal aesthetic, excellent theme system
- **Application**: Terminal-centric color patterns, developer-friendly interactions
- **Key Insight**: Background separation through overlays aligning with core text colors

#### VS Code
- **Strengths**: Industry-standard developer UX, excellent dark theme execution
- **Application**: Sidebar patterns, tab management, panel layouts
- **Key Insight**: Consistent iconography and predictable layouts reduce cognitive load

## Color System

### Midnight Pragmatist Palette

#### Background Colors
```css
--bg-primary: #1e293b;     /* slate-800 - main background */
--bg-secondary: #0f172a;   /* slate-900 - deeper areas */
--bg-tertiary: #334155;    /* slate-700 - elevated surfaces */
--bg-overlay: #475569;     /* slate-600 - modal overlays */
```

#### Text Colors
```css
--text-primary: #f8fafc;   /* slate-50 - primary text */
--text-secondary: #cbd5e1; /* slate-300 - secondary text */
--text-tertiary: #94a3b8;  /* slate-400 - muted text */
--text-inverse: #0f172a;   /* slate-900 - text on light backgrounds */
```

#### Accent Colors
```css
--accent-amber: #f59e0b;   /* amber-500 - primary accent */
--accent-amber-light: #fbbf24; /* amber-400 - hover states */
--accent-amber-dark: #d97706;  /* amber-600 - pressed states */

--accent-cyan: #06b6d4;    /* cyan-500 - secondary accent */
--accent-cyan-light: #22d3ee; /* cyan-400 - hover states */
--accent-cyan-dark: #0891b2;  /* cyan-600 - pressed states */
```

#### Status Colors
```css
--status-success: #10b981;  /* emerald-500 */
--status-warning: #f59e0b;  /* amber-500 */
--status-error: #ef4444;    /* red-500 */
--status-info: #3b82f6;     /* blue-500 */
```

#### Border Colors
```css
--border-primary: #475569;  /* slate-600 - primary borders */
--border-secondary: #334155; /* slate-700 - subtle borders */
--border-focus: #f59e0b;    /* amber-500 - focus states */
```

### Color Usage Guidelines

#### Hierarchy Through Color
1. **Primary Actions**: Amber accent (`--accent-amber`)
2. **Secondary Actions**: Cyan accent (`--accent-cyan`)
3. **Destructive Actions**: Error red (`--status-error`)
4. **Background Content**: Tertiary background (`--bg-tertiary`)

#### Accessibility Considerations
- Minimum contrast ratio of 7:1 for text on backgrounds
- Color never the sole indicator of state or meaning
- Focus indicators always visible and high contrast

## Typography

### Font Stack
```css
/* UI Text */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Code/Terminal */
--font-mono: 'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', monospace;
```

### Type Scale
```css
--text-xs: 0.75rem;   /* 12px - small labels */
--text-sm: 0.875rem;  /* 14px - body text */
--text-base: 1rem;    /* 16px - default text */
--text-lg: 1.125rem;  /* 18px - large body */
--text-xl: 1.25rem;   /* 20px - small headings */
--text-2xl: 1.5rem;   /* 24px - section headings */
--text-3xl: 1.875rem; /* 30px - page headings */
```

### Font Weights
```css
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Usage Guidelines
- **Inter**: All UI text, labels, buttons, navigation
- **JetBrains Mono**: Terminal output, code snippets, technical data
- **Hierarchy**: Use size and weight together; avoid size jumps without weight changes
- **Line Height**: 1.5 for body text, 1.25 for headings

## Spacing System

### Space Scale (8px base)
```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
--space-20: 5rem;    /* 80px */
```

### Application
- **Micro**: `--space-1` to `--space-2` for tight groupings
- **Component**: `--space-3` to `--space-4` for component internal spacing
- **Section**: `--space-6` to `--space-8` for section separation
- **Page**: `--space-12` to `--space-16` for major layout spacing

## Layout Patterns

### Grid System
- **12-column grid** with responsive breakpoints
- **Sidebar**: Fixed 240px width, collapsible to 64px (icon-only)
- **Main Area**: Flexible grid with terminal and ticket panels
- **Bottom Panel**: Fixed height logs area, expandable

### Component Spacing
- **Cards**: `--space-4` internal padding, `--space-2` between elements
- **Buttons**: `--space-3` horizontal, `--space-2` vertical padding
- **Form Fields**: `--space-4` vertical spacing between fields
- **Lists**: `--space-2` between items, `--space-3` between sections

## Component Patterns

### Buttons
```css
.btn-primary {
  background: var(--accent-amber);
  color: var(--text-inverse);
  border-radius: 6px;
  font-weight: var(--font-medium);
  transition: all 150ms ease;
}

.btn-primary:hover {
  background: var(--accent-amber-light);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}
```

### Cards
```css
.card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-secondary);
  border-radius: 8px;
  padding: var(--space-4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card:hover {
  border-color: var(--border-primary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
```

### Input Fields
```css
.input {
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: 6px;
  color: var(--text-primary);
  font-family: var(--font-sans);
}

.input:focus {
  border-color: var(--accent-amber);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
  outline: none;
}
```

## Iconography

### Style Guidelines
- **Stroke width**: 1.5px for consistency
- **Style**: Outlined icons with rounded corners
- **Size**: 16px, 20px, 24px standard sizes
- **Color**: Inherit text color, accent colors for active states

### Usage Patterns
- **Navigation**: 20px icons with text labels
- **Actions**: 16px icons inline with text
- **Status**: 24px icons for prominent states
- **Decorative**: Sparingly used, low opacity

## Micro-Interactions

### Animation Principles
1. **Purposeful**: Every animation serves a functional purpose
2. **Subtle**: Movements should enhance, not distract
3. **Consistent**: Same interaction patterns across components
4. **Performant**: 60fps animations using CSS transforms

### Standard Animations
```css
/* Button hover */
.btn:hover {
  transform: translateY(-1px);
  transition: transform 150ms ease;
}

/* Card hover */
.card:hover {
  transform: translateY(-2px);
  transition: all 200ms ease;
}

/* Modal entrance */
.modal {
  animation: modalFadeIn 200ms ease;
}

@keyframes modalFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* List item addition */
.list-item-enter {
  animation: slideInDown 300ms ease;
}

@keyframes slideInDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## Responsive Behavior

### Breakpoints
```css
--bp-sm: 640px;   /* Small tablets */
--bp-md: 768px;   /* Large tablets */
--bp-lg: 1024px;  /* Small desktops */
--bp-xl: 1280px;  /* Large desktops */
```

### Layout Adaptations
- **< 768px**: Sidebar collapses to overlay mode
- **< 1024px**: Ticket panel moves below terminal
- **< 640px**: Single column layout with stacked panels

## Accessibility

### Requirements
- **Keyboard Navigation**: All interactive elements accessible via keyboard
- **Focus Management**: Clear focus indicators and logical tab order
- **Screen Reader**: Proper ARIA labels and semantic HTML
- **Contrast**: Minimum 7:1 contrast ratios for text
- **Motion**: Respect `prefers-reduced-motion` system setting

### Implementation
```css
/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Focus indicators */
.focusable:focus-visible {
  outline: 2px solid var(--accent-amber);
  outline-offset: 2px;
  border-radius: 4px;
}
```

## Implementation Guidelines

### CSS Custom Properties
Use CSS custom properties for all design tokens to enable easy theming and maintenance.

### Component Architecture
Follow a modular component system where each component is self-contained with its own styles and behavior.

### Performance Considerations
- Use CSS transforms for animations (GPU acceleration)
- Minimize layout thrashing with `transform` and `opacity`
- Implement efficient scroll handling for large lists
- Lazy load non-critical assets

### Browser Support
- **Primary**: Chrome 100+, Firefox 100+, Safari 15+
- **Secondary**: Edge 100+
- **Features**: CSS Grid, Custom Properties, CSS Transforms

## Future Considerations

### Dark/Light Mode Toggle
While initially dark-only, the design system is structured to support light mode themes by swapping color custom properties.

### Customization
Color accent system allows users to customize primary/secondary accent colors while maintaining design consistency.

### Component Library
As the application grows, consider extracting reusable components into a shared design system library.

---

This specification serves as the foundation for implementing Camelot's visual design. All UI components should reference these guidelines to ensure consistency and maintainability.