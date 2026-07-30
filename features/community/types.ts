export type CommunityScreen =
  | "community-hub"
  | "create-post"
  | "article-detail"
  | "notification-center"
  | "community-search-results";

export type CommunityPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  authorRole: "customer" | "doctor" | "pharmacist" | "admin";
  time: string;
  likesCount: number;
  commentsCount: number;
  likedByViewer: boolean;
  savedByViewer: boolean;
  ownedByViewer: boolean;
};

export type CommunityHubData = {
  posts: CommunityPostSummary[];
  featured: CommunityPostSummary | null;
  selectedCategory: string;
  unavailable?: boolean;
};

export type CommunitySearchData = {
  query: string;
  category: string;
  results: CommunityPostSummary[];
  unavailable?: boolean;
};

export type SavedCommunityArticlesData = {
  articles: CommunityPostSummary[];
  unavailable?: boolean;
};

export type CommunityPostEditorData = {
  id: string;
  slug: string;
  title: string;
  body: string;
  category: string;
};
