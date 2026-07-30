export type CommunityCommentItem = {
  id: string;
  author: string;
  time: string;
  body: string;
  verified: boolean;
  ownedByViewer: boolean;
  avatar: "somchai" | "pharmacist";
};

export type CommunityArticleDetailData = {
  id: string;
  slug: string;
  title: string;
  body: string;
  author: string;
  category: string;
  coverImageUrl: string | null;
  likesCount: number;
  commentsCount: number;
  likedByViewer: boolean;
  savedByViewer: boolean;
  ownedByViewer: boolean;
  comments: CommunityCommentItem[];
  state: "ready" | "missing" | "unavailable";
};
