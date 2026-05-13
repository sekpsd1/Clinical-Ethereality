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
    chip: "0 1px 1px rgba(0, 0, 0, 0.05)",
    bioCard: "0 0 40px rgba(0, 96, 103, 0.04)",
    avatar: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
    selectedDate: "0 4px 6px -1px rgba(0, 96, 103, 0.2), 0 2px 4px -2px rgba(0, 96, 103, 0.2)",
    selectedSlot: "0 10px 15px -3px rgba(0, 123, 131, 0.2), 0 4px 6px -4px rgba(0, 123, 131, 0.2)",
    booking: "0 12px 16px rgba(0, 96, 103, 0.3)",
    bookingTop: "0 0 40px rgba(0, 96, 103, 0.06)",
    paymentCard: "0 8px 32px rgba(0, 96, 103, 0.04)",
    promptpay: "0 12px 40px rgba(0, 0, 0, 0.06)",
    paymentTop: "0 40px 0 rgba(0, 96, 103, 0.06)",
    paymentNav: "0 -8px 24px rgba(0, 96, 103, 0.08)",
    paymentActive: "0 10px 15px -3px rgba(15, 118, 110, 0.2), 0 4px 6px -4px rgba(15, 118, 110, 0.2)",
    qrInset: "inset 0 2px 4px rgba(0, 0, 0, 0.05)",
    waitingCountdown: "0 20px 50px rgba(0, 123, 131, 0.08)",
    waitingTop: "0 0 40px rgba(0, 123, 131, 0.06)",
    waitingNav: "0 -4px 40px rgba(0, 123, 131, 0.06)",
    liveHeader: "0 1px 20px rgba(15, 94, 89, 0.06)",
    videoPanel: "0 18px 40px rgba(15, 23, 42, 0.18)",
    liveControls: "0 12px 24px rgba(0, 0, 0, 0.28)",
    chatBubble: "0 3px 10px rgba(15, 23, 42, 0.08)",
    liveEnd: "0 10px 24px rgba(200, 31, 44, 0.3)"
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
  fontFamily: {
    headline: ["Manrope", "var(--font-geist-sans)", "Inter", "ui-sans-serif", "system-ui"],
    body: ["Inter", "var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
    label: ["Inter", "var(--font-geist-sans)", "ui-sans-serif", "system-ui"]
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
    chip: stitchTokens.shadow.chip,
    "bio-card": stitchTokens.shadow.bioCard,
    avatar: stitchTokens.shadow.avatar,
    "selected-date": stitchTokens.shadow.selectedDate,
    "selected-slot": stitchTokens.shadow.selectedSlot,
    booking: stitchTokens.shadow.booking,
    "booking-top": stitchTokens.shadow.bookingTop,
    "payment-card": stitchTokens.shadow.paymentCard,
    promptpay: stitchTokens.shadow.promptpay,
    "payment-top": stitchTokens.shadow.paymentTop,
    "payment-nav": stitchTokens.shadow.paymentNav,
    "payment-active": stitchTokens.shadow.paymentActive,
    "qr-inset": stitchTokens.shadow.qrInset,
    "waiting-countdown": stitchTokens.shadow.waitingCountdown,
    "waiting-top": stitchTokens.shadow.waitingTop,
    "waiting-nav": stitchTokens.shadow.waitingNav,
    "live-header": stitchTokens.shadow.liveHeader,
    "video-panel": stitchTokens.shadow.videoPanel,
    "live-controls": stitchTokens.shadow.liveControls,
    "chat-bubble": stitchTokens.shadow.chatBubble,
    "live-end": stitchTokens.shadow.liveEnd
  },
  backdropBlur: {
    glass: "18px",
    topbar: "12px",
    card: "6px",
    payment: "32px"
  },
  backgroundImage: {
    "primary-gradient": "linear-gradient(162deg, #006067 0%, #007b83 100%)",
    "payment-radial":
      "radial-gradient(55px 182px at 0 0, rgba(0,96,103,0.05), rgba(0,96,103,0) 50%), radial-gradient(55px 182px at 100% 100%, rgba(0,96,103,0.03), rgba(0,96,103,0) 50%), #f7f9fb",
    "advice-radial": "radial-gradient(circle at top right, #d0fbff 0%, #f7f9fb 40%)"
  },
  zIndex: {
    footer: "40",
    header: "30",
    sheet: "50",
    toast: "60"
  }
} satisfies Config["theme"];
