import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseMedical,
  Heart,
  Image as ImageIcon,
  Search,
  UserRound,
  X
} from "lucide-react";

type FilterChip = {
  label: string;
  active?: boolean;
};

type SearchResult = {
  title: string;
  eyebrow: string;
  author: string;
  likes: string;
  date: string;
  imageSrc: string;
  imageAlt: string;
  badge?: string;
  badgeTone?: "light" | "teal";
  icon: "verified" | "review" | "medical";
  authorIcon: "person" | "account" | "medical";
  href?: "/community/vitamin-c-tips";
};

const filters: FilterChip[] = [
  { label: "ทั้งหมด", active: true },
  { label: "บทความแพทย์" },
  { label: "วิตามินซี" },
  { label: "อาหารเสริม" },
  { label: "รีวิวจากผู้ใช้" }
];

const results: SearchResult[] = [
  {
    title: "5 วิตามินเสริมภูมิคุ้มกันที่หมอแนะนำ",
    eyebrow: "Medical Article",
    author: "Dr. Arisara",
    likes: "1.2k",
    date: "Oct 24",
    imageSrc: "/images/community/vitamin-bottles.png",
    imageAlt: "Amber vitamin supplement bottles on a clean clinical surface",
    badge: "Recommended",
    badgeTone: "light",
    icon: "verified",
    authorIcon: "person",
    href: "/community/vitamin-c-tips"
  },
  {
    title: "รีวิว: ทานวิตามินซี 1000mg ติดต่อกัน 1 เดือน",
    eyebrow: "Lifestyle Experience",
    author: "K. Ananya",
    likes: "856",
    date: "Oct 22",
    imageSrc: "/images/community/vitamin-review.png",
    imageAlt: "Smiling woman in morning light after a wellness routine",
    badge: "User Review",
    badgeTone: "teal",
    icon: "review",
    authorIcon: "account"
  },
  {
    title: "วิตามินดีสำคัญอย่างไรกับวัยทำงาน?",
    eyebrow: "Professional Guide",
    author: "Pharmacist",
    likes: "2.4k",
    date: "Oct 20",
    imageSrc: "/images/community/morning-forest.png",
    imageAlt: "Warm morning sunlight over a calm forest",
    icon: "medical",
    authorIcon: "medical"
  }
];

export function CommunitySearchResults() {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f7f9fb] pb-[calc(7.75rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <SearchResultsHeader />

      <main className="mx-auto w-full max-w-mobile px-6 pt-[86px]">
        <section className="rounded-[32px] bg-gradient-to-br from-primary/10 to-white p-1 shadow-[0_18px_50px_rgba(0,96,103,0.05)]">
          <div className="rounded-[31px] bg-white/40 p-6 backdrop-blur-[24px]">
            <label className="relative block">
              <input
                aria-label="Search community"
                className="h-16 w-full rounded-full border-0 bg-[#e6e8ea] px-6 pr-14 font-headline text-[15px] font-semibold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                defaultValue="วิตามิน"
                type="search"
              />
              <button
                aria-label="Clear search"
                className="absolute right-4 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-[#3e494a]/55"
                type="button"
              >
                <X aria-hidden="true" className="size-5" strokeWidth={2.1} />
              </button>
            </label>
          </div>
        </section>

        <section className="mt-9 overflow-hidden">
          <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.map((filter) => (
              <button
                className={
                  filter.active
                    ? "shrink-0 rounded-full bg-primary px-8 py-3 text-sm font-medium text-white shadow-[0_10px_24px_rgba(0,96,103,0.2)] active:scale-95"
                    : "shrink-0 rounded-full border border-white/40 bg-white/60 px-8 py-3 text-sm font-medium text-[#3e494a] shadow-sm backdrop-blur-[24px] active:scale-95"
                }
                key={filter.label}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-9">
          {results.map((result) => (
            <SearchResultCard key={result.title} result={result} />
          ))}
        </section>
      </main>
    </div>
  );
}

function SearchResultsHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-header bg-white/70 shadow-[0_0_40px_rgba(0,96,103,0.06)] backdrop-blur-[24px]">
      <div className="mx-auto flex h-[70px] w-full max-w-mobile items-center px-7">
        <Link
          aria-label="Back to community"
          className="mr-4 flex size-10 items-center justify-center rounded-full text-primary active:scale-95"
          href="/community"
        >
          <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.25} />
        </Link>
        <h1 className="flex-1 font-headline text-[20px] font-bold tracking-wide text-primary">วิตามิน</h1>
        <button
          aria-label="Search"
          className="flex size-10 items-center justify-center rounded-full text-primary active:scale-95"
          type="button"
        >
          <Search aria-hidden="true" className="size-5" strokeWidth={2.25} />
        </button>
      </div>
    </header>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const content = (
    <article className="group overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-[0_4px_40px_rgba(0,96,103,0.06)] transition-all duration-300">
      <div className="relative h-[198px] overflow-hidden">
        <Image
          alt={result.imageAlt}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          fill
          sizes="(max-width: 430px) 100vw, 344px"
          src={result.imageSrc}
        />
        {result.badge ? (
          <div
            className={
              result.badgeTone === "teal"
                ? "absolute right-4 top-4 rounded-full bg-teal-600/80 px-3 py-1 text-[12px] font-bold uppercase text-white backdrop-blur-[24px]"
                : "absolute right-4 top-4 rounded-full bg-white/80 px-3 py-1 text-[12px] font-bold uppercase text-primary backdrop-blur-[24px]"
            }
          >
            {result.badge}
          </div>
        ) : null}
      </div>

      <div className="p-8">
        <div className="mb-3 flex items-center gap-2">
          <ResultIcon variant={result.icon} />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#3e494a]/80">{result.eyebrow}</span>
        </div>

        <h2 className="font-headline text-xl font-bold leading-tight text-[#191c1e]">{result.title}</h2>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <AuthorIcon variant={result.authorIcon} />
            <span className="truncate text-sm font-medium text-[#3e494a]">{result.author}</span>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-xs text-[#3e494a]/60">
            <div className="flex items-center gap-1">
              <Heart aria-hidden="true" className="size-4 fill-[#7f8b8c] text-[#7f8b8c]" />
              <span>{result.likes}</span>
            </div>
            <span>{result.date}</span>
          </div>
        </div>
      </div>
    </article>
  );

  return result.href ? <Link href={result.href}>{content}</Link> : content;
}

function ResultIcon({ variant }: { variant: SearchResult["icon"] }) {
  if (variant === "review") {
    return <ImageIcon aria-hidden="true" className="size-4 text-[#3e494a]/40" strokeWidth={2.25} />;
  }

  if (variant === "medical") {
    return <BadgeCheck aria-hidden="true" className="size-4 fill-primary text-white" strokeWidth={2.25} />;
  }

  return <BadgeCheck aria-hidden="true" className="size-4 fill-primary text-white" strokeWidth={2.25} />;
}

function AuthorIcon({ variant }: { variant: SearchResult["authorIcon"] }) {
  if (variant === "medical") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
        <BriefcaseMedical aria-hidden="true" className="size-[18px]" strokeWidth={2.25} />
      </span>
    );
  }

  if (variant === "account") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#eceef0] text-[#3e494a]">
        <UserRound aria-hidden="true" className="size-[18px]" strokeWidth={2.25} />
      </span>
    );
  }

  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <UserRound aria-hidden="true" className="size-[18px]" strokeWidth={2.25} />
    </span>
  );
}
