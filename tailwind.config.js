/* Tailwind 3: тема для локальної збірки, IntelliSense та Prettier.
   Джерело кольорів, шрифтів, радіусів, тіней і переходів — :root у css/style.css.
   Спільні reset і формула .container застосовуються до всіх сторінок.
   Пороги впорядковані від меншого до більшого; wide зберігає межу 1200px. */
(() => {
  const config = {
    corePlugins: {
      preflight: false,
      container: false,
    },
    theme: {
      screens: {
        narrow: "360px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        navigation: "1100px",
        wide: "1200px",
        xl: "1280px",
        "2xl": "1536px",
      },
      extend: {
        colors: {
          brand: {
            DEFAULT: "var(--color-primary)",
            hover: "var(--color-primary-hover)",
            background: "var(--color-background-light)",
            surface: "var(--color-surface)",
            text: "var(--color-text)",
            muted: "var(--color-text-muted)",
            secondary: "var(--color-secondary)",
            accent: "var(--color-accent)",
            "accent-strong": "var(--color-accent-strong)",
            border: "var(--color-border)",
            control: "var(--color-control-border)",
            soft: "var(--color-background-soft)",
            placeholder: "var(--color-placeholder)",
            success: "var(--color-success)",
            warning: "var(--color-warning)",
            "warning-strong": "var(--color-warning-strong)",
            error: "var(--color-error)",
            focus: "var(--color-focus)",
          },
        },
        maxWidth: {
          site: "var(--container-width)",
          "hero-copy": "var(--hero-copy-width)",
          "hero-media": "var(--hero-media-width)",
          copy: "var(--content-copy-width)",
          "embed-media": "var(--embed-media-width)",
        },
        minHeight: {
          "embed-media": "var(--embed-media-min-height)",
        },
        fontFamily: {
          sans: ["var(--font-primary)"],
          heading: ["var(--font-heading)"],
        },
        boxShadow: {
          card: "var(--shadow-card)",
          "card-hover": "var(--shadow-raised)",
          overlay: "var(--shadow-overlay)",
        },
        fontSize: {
          hero: [
            "var(--font-size-hero)",
            {
              lineHeight: "var(--line-height-display)",
              letterSpacing: "-0.02em",
            },
          ],
          "heading-1": [
            "var(--font-size-h1)",
            {
              lineHeight: "var(--line-height-heading)",
            },
          ],
          "heading-2": [
            "var(--font-size-h2)",
            {
              lineHeight: "var(--line-height-heading)",
            },
          ],
          "heading-3": [
            "var(--font-size-h3)",
            {
              lineHeight: "var(--line-height-heading)",
            },
          ],
          "heading-compact": [
            "min(var(--font-size-h2), var(--font-size-section-compact))",
            {
              lineHeight: "var(--line-height-heading)",
            },
          ],
          "card-title": [
            "var(--font-size-card-title)",
            {
              lineHeight: "var(--line-height-heading)",
            },
          ],
          "body-sm": [
            "var(--font-size-small)",
            {
              lineHeight: "var(--line-height-body)",
            },
          ],
          caption: [
            "var(--font-size-caption)",
            {
              lineHeight: "var(--line-height-body)",
            },
          ],
          control: [
            "var(--font-size-small)",
            {
              lineHeight: "var(--line-height-control)",
            },
          ],
        },
        lineHeight: {
          body: "var(--line-height-body)",
          heading: "var(--line-height-heading)",
        },
        letterSpacing: {
          eyebrow: "var(--letter-spacing-eyebrow)",
        },
        flex: {
          hero: "0 1 var(--hero-media-width)",
        },
        aspectRatio: {
          hero: "24 / 25",
        },
        gridTemplateColumns: {
          benefits: "minmax(0, 400px) minmax(0, 1fr)",
          cta: "minmax(0, 1fr) auto",
        },
        opacity: {
          disabled: "var(--opacity-disabled)",
        },
        borderRadius: {
          control: "var(--radius-control)",
          card: "var(--radius-card)",
          container: "var(--radius-container)",
          media: "var(--radius-media)",
          "embed-media": "var(--embed-media-radius)",
        },
        transitionProperty: {
          brand: "color, background-color, border-color, box-shadow",
        },
        transitionDuration: {
          fast: "var(--transition-duration-fast)",
          normal: "var(--transition-duration-normal)",
          brand:
            "var(--transition-duration-fast), var(--transition-duration-fast), var(--transition-duration-fast), var(--transition-duration-normal)",
        },
        outlineWidth: {
          focus: "3px",
        },
      },
    },
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { content: ["./*.html", "./products/*.html", "./js/*.js"], ...config };
  }
  if (typeof window !== "undefined" && window.tailwind) {
    window.tailwind.config = config;
  }
})();
