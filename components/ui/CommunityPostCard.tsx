import Link from "next/link";
import type { Route } from "next";
import { Heart, MessageSquare, MoreHorizontal, Share2 } from "lucide-react";

type CommunityPostCardProps = {
  author: string;
  time: string;
  body: string;
  likes: string;
  comments: string;
  liked?: boolean;
  portrait: "ananya" | "somchai";
  href?: string;
};

export function CommunityPostCard({ author, time, body, likes, comments, liked, portrait, href }: CommunityPostCardProps) {
  const card = (
    <article className="rounded-[24px] border border-[#f2f4f6] bg-white p-6 shadow-[0_0_40px_rgba(0,96,103,0.04)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="size-10 overflow-hidden rounded-full bg-slate-200">
          <MemberPortrait variant={portrait} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-[#191c1e]">{author}</h3>
          <p className="text-[10px] font-medium text-slate-400">{time}</p>
        </div>
        <button type="button" aria-label="More actions" className="ml-auto text-slate-400">
          <MoreHorizontal aria-hidden="true" className="size-6" />
        </button>
      </div>

      <p className="mb-5 text-sm leading-7 text-[#3e494a]">{body}</p>

      <div className="flex items-center gap-7 border-t border-[#eceef0] pt-4">
        <div className={liked ? "flex items-center gap-2 text-primary" : "flex items-center gap-2 text-slate-400"}>
          <Heart aria-hidden="true" className="size-5" fill={liked ? "#006067" : "#94a3b8"} />
          <span className="text-xs font-bold">{likes}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <MessageSquare aria-hidden="true" className="size-5" fill="#94a3b8" />
          <span className="text-xs font-bold">{comments}</span>
        </div>
        <button type="button" aria-label="Share post" className="ml-auto text-slate-400">
          <Share2 aria-hidden="true" className="size-5" />
        </button>
      </div>
    </article>
  );

  return href ? <Link href={href as Route}>{card}</Link> : card;
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
