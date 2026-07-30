import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { Heart, MessageSquare, MoreHorizontal } from "lucide-react";
import { ShareButton } from "@/components/ui/ShareButton";

type CommunityPostCardProps = {
  title?: string;
  author: string;
  time: string;
  body: string;
  likes: string;
  comments: string;
  liked?: boolean;
  portrait: "ananya" | "somchai";
  href?: string;
  editHref?: string;
  imageSrc?: string | null;
};

export function CommunityPostCard({
  title,
  author,
  time,
  body,
  likes,
  comments,
  liked,
  portrait,
  href,
  editHref,
  imageSrc
}: CommunityPostCardProps) {
  const detailHref = href as Route | undefined;

  return (
    <article className="rounded-[24px] border border-[#f2f4f6] bg-white p-6 shadow-[0_0_40px_rgba(0,96,103,0.04)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="size-10 overflow-hidden rounded-full bg-slate-200">
          <MemberPortrait variant={portrait} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-[#191c1e]">{author}</h3>
          <p className="text-[10px] font-medium text-slate-400">{time}</p>
        </div>
        {editHref || detailHref ? (
          <Link
            href={(editHref ?? detailHref) as Route}
            aria-label={editHref ? "Edit your post" : "Open post"}
            className="ml-auto text-slate-400"
          >
            <MoreHorizontal aria-hidden="true" className="size-6" />
          </Link>
        ) : null}
      </div>

      {detailHref ? (
        <Link href={detailHref} className="block">
          {title ? <h4 className="mb-2 text-base font-extrabold text-[#191c1e]">{title}</h4> : null}
          <p className="mb-5 text-sm leading-7 text-[#3e494a]">{body}</p>
        </Link>
      ) : (
        <>
          {title ? <h4 className="mb-2 text-base font-extrabold text-[#191c1e]">{title}</h4> : null}
          <p className="mb-5 text-sm leading-7 text-[#3e494a]">{body}</p>
        </>
      )}

      {imageSrc ? (
        <div className="relative mb-5 aspect-video overflow-hidden rounded-[18px] bg-[#e6e8ea]">
          <Image
            src={imageSrc}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 430px) calc(100vw - 104px), 326px"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="flex items-center gap-7 border-t border-[#eceef0] pt-4">
        <div className={liked ? "flex items-center gap-2 text-primary" : "flex items-center gap-2 text-slate-400"}>
          <Heart aria-hidden="true" className="size-5" fill={liked ? "#006067" : "#94a3b8"} />
          <span className="text-xs font-bold">{likes}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <MessageSquare aria-hidden="true" className="size-5" fill="#94a3b8" />
          <span className="text-xs font-bold">{comments}</span>
        </div>
        {href ? <ShareButton href={href} className="ml-auto text-slate-400" /> : null}
      </div>
    </article>
  );
}

function MemberPortrait({ variant }: { variant: CommunityPostCardProps["portrait"] }) {
  if (variant === "somchai") {
    return (
      <div className="relative h-full w-full bg-[#27313a]">
        <div className="absolute left-[29%] top-[18%] size-[43%] rounded-full bg-[#c08c68]" />
        <div className="absolute left-[24%] top-[12%] h-[26%] w-[52%] rounded-t-full bg-[#1f2937]" />
        <div className="absolute left-[26%] top-[40%] h-[4px] w-[48%] rounded-full bg-white/70" />
        <div className="absolute bottom-0 left-[20%] h-[38%] w-[60%] rounded-t bg-[#1f2937]" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#d9f4ee]">
      <div className="absolute left-[30%] top-[18%] size-[42%] rounded-full bg-[#d6a078]" />
      <div className="absolute left-[23%] top-[10%] h-[42%] w-[56%] rounded-t-full bg-[#463025]" />
      <div className="absolute left-[40%] top-[48%] h-[3px] w-[20%] rounded-full bg-[#a64b46]" />
      <div className="absolute bottom-0 left-[18%] h-[36%] w-[64%] rounded-t bg-[#70b8ad]" />
    </div>
  );
}
