import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { BadgeCheck, BriefcaseMedical, Heart, Image as ImageIcon, Pin, UserRound } from "lucide-react";

type ArticleCardIcon = "verified" | "review" | "medical";
type ArticleCardAuthorIcon = "person" | "account" | "medical";

type ArticleCardProps = {
  title: string;
  eyebrow: string;
  author: string;
  likes: string;
  date: string;
  imageSrc: string;
  imageAlt: string;
  badge?: string;
  badgeTone?: "light" | "teal";
  icon: ArticleCardIcon;
  authorIcon: ArticleCardAuthorIcon;
  href?: string;
  pinned?: boolean;
  actions?: React.ReactNode;
};

export function ArticleCard({
  title,
  eyebrow,
  author,
  likes,
  date,
  imageSrc,
  imageAlt,
  badge,
  badgeTone,
  icon,
  authorIcon,
  href,
  pinned = false,
  actions
}: ArticleCardProps) {
  const content = (
    <>
      <div className="relative h-[198px] overflow-hidden rounded-t-[24px]">
        <Image
          alt={imageAlt}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          fill
          sizes="(max-width: 430px) 100vw, 344px"
          src={imageSrc}
        />
        {badge || pinned ? (
          <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
            {pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-3 py-1 text-[12px] font-bold text-white backdrop-blur-[24px]">
                <Pin aria-hidden="true" className="size-3 fill-white" /> ปักหมุด
              </span>
            ) : null}
            {badge ? (
              <span
                className={
                  badgeTone === "teal"
                    ? "rounded-full bg-teal-600/80 px-3 py-1 text-[12px] font-bold uppercase text-white backdrop-blur-[24px]"
                    : "rounded-full bg-white/80 px-3 py-1 text-[12px] font-bold uppercase text-primary backdrop-blur-[24px]"
                }
              >
                {badge}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="p-8">
        <div className="mb-3 flex items-center gap-2">
          <ArticleIcon variant={icon} />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#3e494a]/80">{eyebrow}</span>
        </div>

        <h2 className="font-headline text-xl font-bold leading-tight text-[#191c1e]">{title}</h2>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <AuthorIcon variant={authorIcon} />
            <span className="truncate text-sm font-medium text-[#3e494a]">{author}</span>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-xs text-[#3e494a]/60">
            <div className="flex items-center gap-1">
              <Heart aria-hidden="true" className="size-4 fill-[#7f8b8c] text-[#7f8b8c]" />
              <span>{likes}</span>
            </div>
            <span>{date}</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <article className="group relative rounded-[24px] border border-white/10 bg-white shadow-[0_4px_40px_rgba(0,96,103,0.06)] transition-all duration-300">
      {href ? <Link href={href as Route}>{content}</Link> : content}
      {actions ? <div className="absolute left-4 top-4 z-20">{actions}</div> : null}
    </article>
  );
}

function ArticleIcon({ variant }: { variant: ArticleCardIcon }) {
  if (variant === "review") {
    return <ImageIcon aria-hidden="true" className="size-4 text-[#3e494a]/40" strokeWidth={2.25} />;
  }

  if (variant === "medical") {
    return <BadgeCheck aria-hidden="true" className="size-4 fill-primary text-white" strokeWidth={2.25} />;
  }

  return <BadgeCheck aria-hidden="true" className="size-4 fill-primary text-white" strokeWidth={2.25} />;
}

function AuthorIcon({ variant }: { variant: ArticleCardAuthorIcon }) {
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
