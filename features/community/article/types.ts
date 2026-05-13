export type CommunityCommentItem = {
  id: string;
  author: string;
  time: string;
  body: string;
  verified: boolean;
  avatar: "somchai" | "pharmacist";
};

export type CommunityArticleDetailData = {
  id: string;
  title: string;
  body: string;
  author: string;
  likesCount: number;
  commentsCount: number;
  likedByViewer: boolean;
  comments: CommunityCommentItem[];
  unavailable?: boolean;
};
