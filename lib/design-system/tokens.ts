import type { Config } from "tailwindcss";

export const stitchTokens = {
  color: {
    background: "#eef7f4",
    app: "#f7f9fb",
    surface: "#ffffff",
    glass: "rgba(255, 255, 255, 0.76)",
    primary: "#0f8f83",
    primaryStrong: "#07675f",
    text: "#17322f",
    muted: "#647977",
    border: "rgba(15, 143, 131, 0.18)",
    success: "#12805c",
    warning: "#a56a00",
    danger: "#b42318",
    overlay: "rgba(12, 34, 31, 0.36)"
  },
  radius: {
    card: "0.5rem",
    control: "0.5rem",
    nav: "0.75rem",
    badge: "999px"
  },
  shadow: {
    glass: "0 18px 40px rgba(24, 73, 68, 0.10)",
    footer: "0 -12px 28px rgba(24, 73, 68, 0.10)",
    bottomNav: "0 -4px 24px rgba(0, 0, 0, 0.04)",
    doctor: "0 8px 32px rgba(0, 96, 103, 0.05)",
    chip: "0 1px 1px rgba(0, 0, 0, 0.05)"
  }
} as const;

export const stitchTailwindTheme = {
  colors: {
    background: stitchTokens.color.background,
    app: stitchTokens.color.app,
    surface: stitchTokens.color.surface,
    glass: stitchTokens.color.glass,
    primary: stitchTokens.color.primary,
    "primary-strong": stitchTokens.color.primaryStrong,
    text: stitchTokens.color.text,
    muted: stitchTokens.color.muted,
    border: stitchTokens.color.border,
    success: stitchTokens.color.success,
    warning: stitchTokens.color.warning,
    danger: stitchTokens.color.danger,
    overlay: stitchTokens.color.overlay
  },
  fontSize: {
    label: ["0.75rem", { lineHeight: "1rem" }],
    body: ["0.9375rem", { lineHeight: "1.5rem" }],
    section: ["1rem", { lineHeight: "1.5rem" }],
    title: ["1.75rem", { lineHeight: "2.125rem" }]
  },
  maxWidth: {
    mobile: "430px"
  },
  borderRadius: {
    card: stitchTokens.radius.card,
    control: stitchTokens.radius.control,
    nav: stitchTokens.radius.nav,
    badge: stitchTokens.radius.badge
  },
  boxShadow: {
    glass: stitchTokens.shadow.glass,
    footer: stitchTokens.shadow.footer,
    "bottom-nav": stitchTokens.shadow.bottomNav,
    doctor: stitchTokens.shadow.doctor,
    chip: stitchTokens.shadow.chip
  },
  backdropBlur: {
    glass: "18px",
    topbar: "12px",
    card: "6px"
  },
  backgroundImage: {
    "primary-gradient": "linear-gradient(162deg, #006067 0%, #007b83 100%)"
  },
  zIndex: {
    footer: "40",
    header: "30",
    sheet: "50",
    toast: "60"
  }
} satisfies Config["theme"];
